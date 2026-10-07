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

  const body = await req.json().catch(() => null);
  const result = await provider.parseWebhook(body, req.headers);
  if (!result) return Response.json({ error: "Notification invalide" }, { status: 400 });

  const payment = await db.payment.findFirst({ where: { provider: provider.name, providerRef: result.providerRef } });
  if (!payment) return Response.json({ error: "Paiement introuvable" }, { status: 404 });

  await db.payment.update({ where: { id: payment.id }, data: { raw: body ?? undefined } });
  if (result.status !== "PENDING") await applyPaymentResult(payment.id, result.status);
  return Response.json({ ok: true });
}
