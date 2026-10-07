"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { refundOrder } from "@/lib/orders";
import { sendSms } from "@/lib/notify";
import { getPaymentProvider } from "@/lib/payments";
import { formatLiters, formatXaf } from "@/lib/format";
import { setSetting } from "@/lib/settings";

export async function setSupplierStatus(formData: FormData) {
  await requireRole("ADMIN");
  const supplierId = String(formData.get("supplierId"));
  const status = String(formData.get("status"));
  if (status !== "APPROVED" && status !== "SUSPENDED") return;
  const supplier = await db.supplier.update({ where: { id: supplierId }, data: { status }, include: { user: true } });
  if (status === "APPROVED") {
    await sendSms(supplier.user.phone, "MaCuve : votre compte livreur est activé. Connectez-vous pour voir les commandes de votre zone.");
  }
  revalidatePath("/admin/fournisseurs");
}

export async function savePricing(formData: FormData) {
  await requireRole("ADMIN");
  const commission = Number(formData.get("commissionPercent"));
  if (!Number.isFinite(commission) || commission < 0 || commission > 50) redirect("/admin/tarifs?erreur=commission");
  await setSetting("commissionPercent", String(commission));

  for (const [key, value] of formData.entries()) {
    const priceMatch = /^price:(.+):(.+)$/.exec(key);
    if (priceMatch) {
      const amount = Number(value);
      const [, zoneId, tierId] = priceMatch;
      if (String(value).trim() === "") {
        await db.price.deleteMany({ where: { zoneId, tierId } });
      } else if (Number.isInteger(amount) && amount > 0) {
        await db.price.upsert({
          where: { zoneId_tierId: { zoneId, tierId } },
          create: { zoneId, tierId, amountXaf: amount },
          update: { amountXaf: amount },
        });
      }
    }
    const zoneMatch = /^neighborhoods:(.+)$/.exec(key);
    if (zoneMatch) {
      const neighborhoods = String(value)
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      await db.zone.update({ where: { id: zoneMatch[1] }, data: { neighborhoods } });
    }
  }
  redirect("/admin/tarifs?enregistre=1");
}

export async function adminRefund(formData: FormData) {
  await requireRole("ADMIN");
  const result = await refundOrder(String(formData.get("orderId")));
  redirect(result.ok ? "/admin?rembourse=1" : `/admin?erreur=${encodeURIComponent(result.error ?? "")}`);
}

export async function assignSupplier(formData: FormData) {
  await requireRole("ADMIN");
  const orderId = String(formData.get("orderId"));
  const supplierId = String(formData.get("supplierId"));
  if (!supplierId) return;
  const updated = await db.order.updateMany({
    where: { id: orderId, status: "PAID", supplierId: null },
    data: { status: "ACCEPTED", supplierId, acceptedAt: new Date() },
  });
  if (updated.count > 0) {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { supplier: { include: { user: true } } } });
    await sendSms(
      order.supplier!.user.phone,
      `MaCuve : la commande ${formatLiters(order.liters)} à ${order.neighborhood} vous a été attribuée. Connectez-vous pour la voir.`,
    );
    await sendSms(
      order.customerPhone,
      `MaCuve : ${order.supplier!.businessName} (${order.supplier!.user.phone}) va livrer vos ${formatLiters(order.liters)}. Commande ${order.ref}.`,
    );
  }
  revalidatePath("/admin");
}

export async function runPayout(formData: FormData) {
  await requireRole("ADMIN");
  const supplierId = String(formData.get("supplierId"));
  const supplier = await db.supplier.findUniqueOrThrow({ where: { id: supplierId }, include: { user: true } });
  const orders = await db.order.findMany({ where: { supplierId, status: "DELIVERED", payoutId: null } });
  if (orders.length === 0) redirect("/admin/reversements");

  const amountXaf = orders.reduce((sum, o) => sum + o.amountXaf - o.commissionXaf, 0);
  const provider = getPaymentProvider();
  const payout = await db.payout.create({
    data: {
      supplierId,
      amountXaf,
      msisdn: supplier.airtelNumber,
      provider: provider.name,
      orders: { connect: orders.map((o) => ({ id: o.id })) },
    },
  });

  const result = await provider.payout({ msisdn: supplier.airtelNumber, amountXaf, reference: payout.id });
  if (!result.ok) {
    // Les commandes sont libérées pour un prochain essai.
    await db.order.updateMany({ where: { payoutId: payout.id }, data: { payoutId: null } });
    await db.payout.update({ where: { id: payout.id }, data: { status: "FAILED" } });
    redirect(`/admin/reversements?erreur=${encodeURIComponent(result.error ?? "Reversement refusé")}`);
  }

  await db.payout.update({
    where: { id: payout.id },
    data: { status: "PAID", paidAt: new Date(), providerRef: result.providerRef },
  });
  await sendSms(
    supplier.user.phone,
    `MaCuve : ${formatXaf(amountXaf)} versés sur votre Airtel Money pour ${orders.length} livraison(s).`,
  );
  redirect("/admin/reversements?verse=1");
}
