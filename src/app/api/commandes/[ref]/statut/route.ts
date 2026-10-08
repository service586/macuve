import { db } from "@/lib/db";
import { applyPaymentResult } from "@/lib/orders";
import { getPaymentProvider } from "@/lib/payments";
import { advanceDispatch } from "@/lib/dispatch";

export async function GET(_req: Request, ctx: RouteContext<"/api/commandes/[ref]/statut">) {
  const { ref } = await ctx.params;
  const order = await db.order.findUnique({
    where: { ref },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) return Response.json({ error: "Commande introuvable" }, { status: 404 });

  let payment = order.payments[0];
  // Consultation du statut chez le prestataire si le paiement est toujours en attente.
  if (payment?.status === "PENDING" && payment.providerRef) {
    const provider = getPaymentProvider(payment.provider);
    if (!provider.isTestMode) {
      const status = await provider.checkStatus(payment.providerRef);
      if (status !== "PENDING") {
        await applyPaymentResult(payment.id, status);
        payment = { ...payment, status };
      }
    }
  }

  await advanceDispatch();
  const fresh = await db.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
  return Response.json({ status: fresh.status, paymentStatus: payment?.status });
}
