import type { PaymentStatus } from "@prisma/client";
import { db } from "./db";
import { formatLiters, formatXaf } from "./format";
import { sendSms } from "./notify";
import { getPaymentProvider } from "./payments";
import { closeOffers, offerToNearest } from "./dispatch";

// Applique le résultat d'un paiement. Idempotent : un appel de retour reçu
// deux fois, ou après la consultation du statut, ne change rien.
export async function applyPaymentResult(paymentId: string, status: Exclude<PaymentStatus, "PENDING">) {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
  if (!payment || payment.status !== "PENDING") return;

  await db.payment.update({ where: { id: paymentId }, data: { status } });
  if (status !== "SUCCESS") return;

  const { order } = payment;
  const updated = await db.order.updateMany({
    where: { id: order.id, status: "PENDING_PAYMENT" },
    data: { status: "PAID", paidAt: new Date() },
  });
  if (updated.count === 0) return;

  await sendSms(
    order.customerPhone,
    `MaCuve : paiement de ${formatXaf(order.amountXaf)} reçu pour ${formatLiters(order.liters)}. ` +
      `Commande ${order.ref}. Code de livraison à donner au livreur : ${order.deliveryCode}.`,
  );

  await offerToNearest(order.id);
}

export async function notifyCustomerAssigned(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { supplier: { include: { user: true } } } });
  await closeOffers(order.id);
  await sendSms(
    order.customerPhone,
    `MaCuve : ${order.supplier!.businessName} (${order.supplier!.user.phone}) va livrer vos ${formatLiters(order.liters)}. ` +
      `Suivez-le sur la carte : commande ${order.ref}.`,
  );
}

export async function refundOrder(orderId: string): Promise<{ ok: boolean; error?: string }> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { payments: { where: { status: "SUCCESS" } } },
  });
  if (!order) return { ok: false, error: "Commande introuvable" };
  if (!["PAID", "ACCEPTED", "EN_ROUTE"].includes(order.status)) {
    return { ok: false, error: "Seule une commande payée et non livrée peut être remboursée" };
  }
  const payment = order.payments[0];
  if (!payment) return { ok: false, error: "Aucun paiement réussi trouvé" };

  const result = await getPaymentProvider(payment.provider).refund({
    paymentRef: payment.providerRef ?? "",
    msisdn: payment.msisdn,
    amountXaf: order.amountXaf,
    reference: order.ref,
  });
  if (!result.ok) return { ok: false, error: result.error ?? "Remboursement refusé par le prestataire" };

  await db.order.update({ where: { id: order.id }, data: { status: "REFUNDED", refundedAt: new Date() } });
  await closeOffers(order.id);
  await sendSms(
    payment.msisdn,
    `MaCuve : votre commande ${order.ref} a été remboursée (${formatXaf(order.amountXaf)}).`,
  );
  return { ok: true };
}
