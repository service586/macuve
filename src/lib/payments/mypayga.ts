import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { PaymentProvider, ProviderPaymentStatus, TransferResult } from "./types";

// MyPayGa (https://mypayga.com/docs) : agrégateur mobile money (Airtel Money, Moov Money…).
//
// - Une seule adresse d'API ; la clé décide du mode : `stest_…` (test) ou `sprod_…` (réel).
// - La clé est envoyée dans le corps JSON (POST) ou dans l'adresse (GET), pas dans un en-tête.
// - Le résultat final d'un paiement arrive par appel de retour (callback), signé en
//   HMAC-SHA512 avec la clé secrète. La consultation du statut sert de secours.
// - Il n'y a pas de remboursement dédié : on rembourse par un transfert (disbursement) vers le client.

const API_URL = (process.env.MYPAYGA_API_URL ?? "https://api.mypayga.com").replace(/\/$/, "");
const COUNTRY = "GA";
const TIMEOUT_MS = 20_000;

function apiKey(): string {
  const key = process.env.MYPAYGA_API_KEY;
  if (!key) throw new Error("MYPAYGA_API_KEY manquant");
  return key;
}

export function isMyPayGaSandbox(): boolean {
  return (process.env.MYPAYGA_API_KEY ?? "").startsWith("stest_");
}

// Adresse publique du site, pour que MyPayGa sache où envoyer l'appel de retour.
function siteUrl(): string {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  // Sur un aperçu Vercel, l'adresse de production renverrait le client et l'appel de retour au mauvais site.
  const vercel =
    process.env.VERCEL_ENV === "production"
      ? (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL)
      : (process.env.VERCEL_BRANCH_URL ?? process.env.VERCEL_URL);
  if (vercel) return `https://${vercel}`;
  throw new Error("APP_URL manquant : adresse publique du site nécessaire pour l'appel de retour MyPayGa");
}

// Code opérateur attendu par MyPayGa, d'après le préfixe gabonais.
export function networkFor(msisdn: string): "AM" | "MC" {
  return /^06/.test(msisdn) ? "MC" : "AM";
}

// MyPayGa renvoie des codes (200 réussi, 202 en attente, 400 échoué), et parfois des mots.
export function mapStatus(value: unknown): ProviderPaymentStatus {
  const s = String(value ?? "").trim().toUpperCase();
  if (["200", "SUCCESS", "SUCCESSFUL", "SUCCESSFULL", "SUCCEEDED", "COMPLETED", "PAID", "APPROVED"].includes(s)) return "SUCCESS";
  if (s === "400" || s === "FAILED" || s === "FAILURE" || s === "FAIL" || s === "CANCELLED" || s === "CANCELED") {
    return "FAILED";
  }
  return "PENDING";
}

async function call<T>(method: "GET" | "POST", path: string, data: Record<string, unknown>): Promise<T> {
  const url = new URL(API_URL + path);
  const init: RequestInit = { method, signal: AbortSignal.timeout(TIMEOUT_MS) };
  if (method === "GET") {
    for (const [k, v] of Object.entries(data)) url.searchParams.set(k, String(v));
  } else {
    init.headers = { "Content-Type": "application/json", Accept: "application/json" };
    init.body = JSON.stringify(data);
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`MyPayGa ${path} : réponse illisible (HTTP ${res.status})`);
  }
  if (!res.ok) {
    const message = (json as { message?: string })?.message;
    throw new Error(`MyPayGa ${path} : HTTP ${res.status}${message ? ` – ${message}` : ""}`);
  }
  return json as T;
}

// --- Signature des appels de retour -------------------------------------------------

const SIGNED_FIELDS = ["order_status", "unique_id", "amount", "payment_token", "payment_method", "message", "client_phone"];

// Le montant est signé tel qu'il est écrit dans le JSON (25000, "25000" ou 25000.00) : on le
// relit dans le texte brut pour ne pas dépendre de la conversion en nombre de JavaScript.
function rawAmount(rawBody: string | undefined, parsed: unknown): string[] {
  const out = new Set<string>();
  const m = rawBody?.match(/"amount"\s*:\s*("?)([^",}\s]*)\1/);
  if (m) out.add(m[2]);
  if (parsed !== undefined && parsed !== null) out.add(String(parsed));
  return [...out];
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function verifyCallbackSignature(
  body: Record<string, unknown>,
  received: string,
  secret: string,
  rawBody?: string,
): boolean {
  if (!received) return false;
  const given = received.trim();
  for (const amount of rawAmount(rawBody, body.amount)) {
    const payload = SIGNED_FIELDS.map((f) => (f === "amount" ? amount : String(body[f] ?? ""))).join("");
    const mac = createHmac("sha512", secret).update(payload).digest();
    // La doc ne précise pas l'encodage : on accepte l'hexadécimal (comme hash_hmac en PHP) et le base64.
    if (safeEqual(given.toLowerCase(), mac.toString("hex")) || safeEqual(given, mac.toString("base64"))) return true;
  }
  return false;
}

// Recherche de la recette réellement utilisée par MyPayGa quand la recette documentée échoue :
// mêmes champs mais montant formaté autrement, séparateur, devise ajoutée, JSON… Une
// correspondance reste une preuve d'authenticité (HMAC calculé avec une clé du marchand).
export function findSignatureVariant(
  body: Record<string, unknown>,
  received: string,
  keys: [string, string | undefined][],
  rawBody?: string,
): string | null {
  const given = received.trim();
  if (!given) return null;
  const amounts = new Set(rawAmount(rawBody, body.amount));
  const n = Number(body.amount);
  if (Number.isFinite(n)) {
    for (const a of [String(Math.trunc(n)), n.toFixed(1), n.toFixed(2), n.toFixed(3)]) amounts.add(a);
  }
  const fieldSets: [string, string[]][] = [
    ["doc", SIGNED_FIELDS],
    ["doc+currency", [...SIGNED_FIELDS, "currency"]],
    ["body-order", Object.keys(body).filter((k) => k !== "callback_signature")],
    ["sorted", Object.keys(body).filter((k) => k !== "callback_signature").sort()],
  ];
  const payloads: [string, string][] = [];
  for (const [setName, fields] of fieldSets) {
    for (const amount of amounts) {
      for (const sep of ["", "|", ",", ";", ":"]) {
        const value = fields.map((f) => (f === "amount" ? amount : String(body[f] ?? ""))).join(sep);
        payloads.push([`${setName} amount=${amount} sep=${JSON.stringify(sep)}`, value]);
      }
    }
  }
  // Variantes des valeurs elles-mêmes (recette documentée, sans séparateur) : accents encodés
  // autrement, statut en mot, numéro au format international.
  const message = String(body.message ?? "");
  const rawMessage = rawBody?.match(/"message"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  const entities: Record<string, string> = { é: "&eacute;", è: "&egrave;", ê: "&ecirc;", à: "&agrave;", ç: "&ccedil;", ô: "&ocirc;", ù: "&ugrave;", î: "&icirc;" };
  const messages: [string, string][] = [
    ["msg", message],
    ["msg-nfd", message.normalize("NFD")],
    ["msg-sans-accents", message.normalize("NFD").replace(/[\u0300-\u036f]/g, "")],
    ["msg-entites", message.replace(/[éèêàçôùî]/g, (c) => entities[c] ?? c)],
    ["msg-json", JSON.stringify(message).slice(1, -1)],
    ["msg-json-ascii", JSON.stringify(message).slice(1, -1).replace(/[\u0080-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`)],
    ["msg-vide", ""],
  ];
  if (rawMessage !== undefined) messages.push(["msg-brut", rawMessage]);
  const statuses = [...new Set([String(body.order_status ?? ""), "SUCCESS", "200"])];
  const phone = String(body.client_phone ?? "");
  const phones = [...new Set([phone, phone.replace(/^0/, "241"), phone.replace(/^0/, "+241"), phone.replace(/^0/, "")])];
  for (const [msgName, msg] of messages) {
    for (const st of statuses) {
      for (const ph of phones) {
        for (const amount of amounts) {
          const value = [st, String(body.unique_id ?? ""), amount, String(body.payment_token ?? ""), String(body.payment_method ?? ""), msg, ph].join("");
          payloads.push([`doc ${msgName} status=${st} phone=${ph} amount=${amount}`, value]);
        }
      }
    }
  }

  const { callback_signature: _sig, ...rest } = body;
  void _sig;
  payloads.push(["json-sans-signature", JSON.stringify(rest)]);
  if (rawBody) payloads.push(["corps-brut", rawBody]);

  for (const [keyName, key] of keys) {
    if (!key) continue;
    const keyForms: [string, Buffer | string][] = [[keyName, key]];
    if (/^[A-Za-z0-9+/=_-]+$/.test(key)) keyForms.push([`${keyName}(base64)`, Buffer.from(key.replace(/-/g, "+").replace(/_/g, "/"), "base64")]);
    if (/^[0-9a-f]+$/i.test(key) && key.length % 2 === 0) keyForms.push([`${keyName}(hex)`, Buffer.from(key, "hex")]);
    for (const [formName, k] of keyForms) {
      for (const [desc, payload] of payloads) {
        for (const enc of ["utf8", "latin1"] as const) {
          const hex = createHmac("sha512", k).update(Buffer.from(payload, enc)).digest("hex");
          if (safeEqual(given.toLowerCase(), hex)) return `${formName} / ${desc} / ${enc}`;
        }
      }
    }
  }
  return null;
}

// --- Transferts (reversements aux livreurs et remboursements) -----------------------

interface DisbursementResponse {
  request_status?: string | number;
  transfert_status?: string | number;
  message?: string;
  transaction_id?: string | number;
}

async function disburse(msisdn: string, amountXaf: number, transactionId: string, name: string): Promise<TransferResult> {
  try {
    const res = await call<DisbursementResponse>("POST", "/v1/disbursement/send", {
      urls: { callback_url: null },
      apikey: apiKey(),
      receiver_account: msisdn,
      amount: String(amountXaf),
      country: COUNTRY,
      network: networkFor(msisdn),
      transaction_id: transactionId,
      account_type: "mobile_money",
      type: "B2C",
      firstname: name,
      lastname: "MaCuve",
      currency: "FCFA",
    });
    const status = String(res.transfert_status ?? "");
    // 200 : versé. 202 : en cours chez l'opérateur, l'argent est parti ; à vérifier dans l'espace marchand.
    if (status === "200" || status === "202") return { ok: true, providerRef: transactionId };
    return { ok: false, providerRef: transactionId, error: res.message || `Transfert refusé (statut ${status || "inconnu"})` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erreur MyPayGa" };
  }
}

// --- Prestataire ---------------------------------------------------------------------

interface PaymentResponse {
  request_status?: string | number;
  message?: string;
  unique_id?: string;
  payment_token?: string;
}

interface StatusResponse {
  order_status?: string | number;
  request_status?: string | number;
  amount?: string | number;
  message?: string;
}

// Requête documentée : unique_id (celui envoyé à la création) + country_code, clé API.
// Les variantes d'essai (jeton, clé publique…) ont été retirées : MyPayGa les voyait passer.
function statusAttempts(uniqueId: string): Record<string, string>[] {
  return [{ unique_id: uniqueId, country_code: COUNTRY }];
}

async function lookupStatus(
  uniqueId: string,
  token?: string,
): Promise<{ res: StatusResponse; attempt: number; tried: string[] }> {
  const tried: string[] = [];
  let last: StatusResponse = {};
  void token;
  const attempts = statusAttempts(uniqueId);
  const combos = attempts.map((params) => ({ keyName: "sprod", key: apiKey(), params }));
  for (let i = 0; i < combos.length; i++) {
    const { keyName, key, params } = combos[i];
    try {
      last = await call<StatusResponse>("GET", "/v1/payment/status", { ...params, apikey: key });
      tried.push(`${keyName}:${Object.keys(params).join("+")} → ${JSON.stringify(last)}`);
      if (last.order_status !== null && last.order_status !== undefined && last.order_status !== "") {
        return { res: last, attempt: i + 1, tried };
      }
    } catch (e) {
      tried.push(`${keyName}:${Object.keys(params).join("+")} → ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { res: last, attempt: 0, tried };
}

// Réponses brutes de MyPayGa pour un paiement (sans la clé), pour le diagnostic dans l'admin.
export async function myPayGaRawStatus(uniqueId: string, token?: string): Promise<string> {
  const { tried } = await lookupStatus(uniqueId, token);
  return tried.join(" | ");
}

// Statut d'un paiement lu directement chez MyPayGa (appel authentifié par notre clé API).
export async function fetchStatus(uniqueId: string, token?: string): Promise<{ status: ProviderPaymentStatus; amountXaf?: number }> {
  const { res, attempt, tried } = await lookupStatus(uniqueId, token);
  const status = mapStatus(res.order_status);
  if (status === "PENDING" || attempt > 1) {
    console.log(`MyPayGa : statut de ${uniqueId} (essai ${attempt}) :`, tried.join(" | "));
  }
  const amount = Number(res.amount);
  return { status, amountXaf: Number.isFinite(amount) ? amount : undefined };
}

export const myPayGaProvider: PaymentProvider = {
  name: "mypayga",
  // Les clés de test passent par la vraie API MyPayGa (numéros de test déclarés dans
  // l'espace marchand) : pas de boutons de simulation sur le site.
  isTestMode: false,

  async requestPayment({ orderRef, msisdn, amountXaf, customerName }) {
    // Identifiant unique par tentative : un client peut réessayer plusieurs fois la même commande.
    const uniqueId = `${orderRef}-${randomBytes(4).toString("hex").toUpperCase()}`;
    const base = siteUrl();
    const back = `${base}/commande/${encodeURIComponent(orderRef)}/paiement`;
    const [firstname, ...rest] = (customerName ?? "").trim().split(/\s+/);
    const res = await call<PaymentResponse>("POST", "/v1/payment", {
      urls: {
        success_url: `${base}/commande/${encodeURIComponent(orderRef)}`,
        callback_url: `${base}/api/paiement/webhook/mypayga`,
        fail_url: back,
      },
      apikey: apiKey(),
      client_phone: msisdn,
      amount: String(amountXaf),
      country: COUNTRY,
      network: networkFor(msisdn),
      type: "mobile_money",
      unique_id: uniqueId,
      firstname: firstname || "Client",
      lastname: rest.join(" ") || "MaCuve",
      email: process.env.MYPAYGA_CONTACT_EMAIL ?? "",
    });
    if (String(res.request_status) !== "200") {
      throw new Error(res.message || `Demande de paiement refusée (statut ${res.request_status ?? "inconnu"})`);
    }
    return { providerRef: uniqueId };
  },

  async checkStatus(providerRef) {
    return (await fetchStatus(providerRef)).status;
  },

  async parseWebhook(body, headers, rawBody) {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    const uniqueId = typeof data.unique_id === "string" ? data.unique_id : "";
    if (!uniqueId) return null;

    const secret = process.env.MYPAYGA_SECRET_KEY?.trim();
    const signature = headers.get("x-callback-signature") ?? String(data.callback_signature ?? "");
    // La doc ne dit pas clairement quelle clé signe : on essaie la clé secrète, puis la clé API
    // (sprod_) et la clé publique (pprod_) si elle est fournie, et on note celle qui marche.
    const candidates: [string, string | undefined][] = [
      ["MYPAYGA_SECRET_KEY", secret],
      ["MYPAYGA_API_KEY", process.env.MYPAYGA_API_KEY?.trim()],
      ["MYPAYGA_PUBLIC_KEY", process.env.MYPAYGA_PUBLIC_KEY?.trim()],
    ];
    const matched = candidates.find(([, key]) => key && verifyCallbackSignature(data, signature, key, rawBody));
    if (matched && matched[0] !== "MYPAYGA_SECRET_KEY") {
      console.log(`MyPayGa : signature vérifiée avec ${matched[0]}`);
    }
    const variant = matched ? null : findSignatureVariant(data, signature, candidates, rawBody);
    if (variant) console.log(`MyPayGa : signature reconnue avec la variante ${variant}`);
    if (matched || variant) {
      const amount = Number(data.amount);
      return {
        providerRef: uniqueId,
        status: mapStatus(data.order_status),
        amountXaf: Number.isFinite(amount) ? amount : undefined,
      };
    }

    // Signature absente ou non reconnue : on ne croit pas le contenu de la notification, on
    // redemande le statut à MyPayGa avec notre clé API, ce qui est tout aussi sûr.
    console.warn(
      "MyPayGa (v3) : signature d'appel de retour non reconnue, vérification du statut auprès de MyPayGa.",
      JSON.stringify({
        values: Object.fromEntries(Object.entries(data).filter(([k]) => k !== "callback_signature")),
        // La signature n'est pas secrète : elle permet de rejouer le calcul hors ligne.
        receivedSignature: signature,
        rawAmount: rawBody?.match(/"amount"\s*:\s*[^,}]*/)?.[0],
        secretConfigured: Boolean(secret),
        headerSignature: headers.has("x-callback-signature"),
        bodySignature: "callback_signature" in data,
        signatureLength: signature.length,
        fields: Object.keys(data),
        contentType: headers.get("content-type"),
      }),
    );
    try {
      const token = typeof data.payment_token === "string" ? data.payment_token : undefined;
      const checked = await fetchStatus(uniqueId, token);
      return { providerRef: uniqueId, ...checked };
    } catch (e) {
      console.error("MyPayGa : vérification du statut impossible :", e);
      return null;
    }
  },

  async refund({ msisdn, amountXaf, reference }) {
    return disburse(msisdn, amountXaf, `RMB-${reference}`, "Client");
  },

  async payout({ msisdn, amountXaf, reference }) {
    return disburse(msisdn, amountXaf, `REV-${reference}`, "Livreur");
  },
};
