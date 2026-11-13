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
  if (s === "200" || s === "SUCCESS" || s === "SUCCESSFUL" || s === "SUCCEEDED") return "SUCCESS";
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
    const res = await call<StatusResponse>("GET", "/v1/payment/status", {
      unique_id: providerRef,
      apikey: apiKey(),
      country_code: COUNTRY,
    });
    return mapStatus(res.order_status);
  },

  async parseWebhook(body, headers, rawBody) {
    if (!body || typeof body !== "object") return null;
    const data = body as Record<string, unknown>;
    const secret = process.env.MYPAYGA_SECRET_KEY;
    if (!secret) {
      console.error("MyPayGa : MYPAYGA_SECRET_KEY manquant, appel de retour refusé");
      return null;
    }
    const signature = headers.get("x-callback-signature") ?? String(data.callback_signature ?? "");
    if (!verifyCallbackSignature(data, signature, secret, rawBody)) {
      console.error("MyPayGa : signature d'appel de retour invalide");
      return null;
    }
    if (typeof data.unique_id !== "string" || !data.unique_id) return null;
    const amount = Number(data.amount);
    return {
      providerRef: data.unique_id,
      status: mapStatus(data.order_status),
      amountXaf: Number.isFinite(amount) ? amount : undefined,
    };
  },

  async refund({ msisdn, amountXaf, reference }) {
    return disburse(msisdn, amountXaf, `RMB-${reference}`, "Client");
  },

  async payout({ msisdn, amountXaf, reference }) {
    return disburse(msisdn, amountXaf, `REV-${reference}`, "Livreur");
  },
};
