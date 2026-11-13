import { db } from "@/lib/db";
import { applyPaymentResult } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";

// Appel de retour (webhook) envoyé par le prestataire quand le client a validé ou refusé.
export async function POST(req: Request, ctx: RouteContext<"/api/paiement/webhook/[provider]">) {
  const { provider: name } = await ctx.params;
  let provider;
  try {
    provider = getPaymentProvider(name);
  } catch {
    return Response.json({ error: "Prestataire inconnu" }, { status: 404 });
  }
  if (provider.isTestMode && process.env.NODE_ENV === "production") {
    return Response.json({ error: "Désactivé" }, { status: 403 });
  }

  const rawBody = await req.text().catch(() => "");
  let body: unknown = null;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Certains prestataires envoient un formulaire plutôt que du JSON.
    body = rawBody ? Object.fromEntries(new URLSearchParams(rawBody)) : null;
  }
  const result = await provider.parseWebhook(body, req.headers, rawBody);
  if (!result) return Response.json({ error: "Notification invalide" }, { status: 400 });

  const payment = await db.payment.findFirst({ where: { provider: provider.name, providerRef: result.providerRef } });
  if (!payment) return Response.json({ error: "Paiement introuvable" }, { status: 404 });

  await db.payment.update({ where: { id: payment.id }, data: { raw: body ?? undefined } });
  // Un montant différent de celui demandé n'est jamais accepté comme paiement réussi.
  if (result.status === "SUCCESS" && result.amountXaf !== undefined && result.amountXaf !== payment.amountXaf) {
    console.error(`Paiement ${payment.id} : montant reçu ${result.amountXaf} ≠ ${payment.amountXaf}`);
    return Response.json({ error: "Montant incohérent" }, { status: 400 });
  }
  // Les notifications peuvent être renvoyées : applyPaymentResult ne fait rien la deuxième fois.
  if (result.status !== "PENDING") await applyPaymentResult(payment.id, result.status);
  return Response.json({ ok: true });
}
