"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { newDeliveryCode, newOrderRef } from "@/lib/codes";
import { getCommissionPercent } from "@/lib/settings";
import { isAirtelNumber, normalizeGabonPhone } from "@/lib/phone";
import { getPaymentProvider } from "@/lib/payments";
import { applyPaymentResult } from "@/lib/orders";
import { isInGrandLibreville } from "@/lib/geo";

export type FormState = { error?: string } | undefined;

const SLOTS = ["Dès que possible", "Aujourd'hui", "Demain matin", "Demain après-midi"] as const;

const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Indiquez votre nom"),
  phone: z.string().trim().min(8, "Indiquez votre numéro Airtel Money"),
  zoneId: z.string().min(1, "Choisissez votre commune"),
  neighborhood: z.string().trim().min(2, "Indiquez votre quartier"),
  landmark: z.string().trim().min(3, "Indiquez un repère pour trouver votre domicile"),
  tierId: z.string().min(1, "Choisissez un volume"),
  slot: z.enum(SLOTS),
  lat: z.coerce.number({ error: "Placez votre domicile sur la carte" }),
  lng: z.coerce.number({ error: "Placez votre domicile sur la carte" }),
});

export async function createOrder(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = orderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  if (!isInGrandLibreville(input)) return { error: "Placez votre domicile sur la carte, dans le Grand Libreville" };

  const phone = normalizeGabonPhone(input.phone);
  if (!phone) return { error: "Numéro invalide. Exemple : 077 12 34 56" };
  if (!isAirtelNumber(phone)) return { error: "Le paiement se fait par Airtel Money : indiquez un numéro Airtel (074, 076 ou 077)" };

  const price = await db.price.findUnique({
    where: { zoneId_tierId: { zoneId: input.zoneId, tierId: input.tierId } },
    include: { tier: true, zone: true },
  });
  if (!price || !price.tier.active || !price.zone.active) return { error: "Ce volume n'est pas disponible dans cette commune" };

  const commissionPercent = await getCommissionPercent();
  const order = await db.order.create({
    data: {
      ref: newOrderRef(),
      customerName: input.customerName,
      customerPhone: phone,
      zoneId: input.zoneId,
      neighborhood: input.neighborhood,
      landmark: input.landmark,
      slot: input.slot,
      lat: input.lat,
      lng: input.lng,
      liters: price.tier.liters,
      amountXaf: price.amountXaf,
      commissionXaf: Math.round((price.amountXaf * commissionPercent) / 100),
      deliveryCode: newDeliveryCode(),
    },
  });

  await startPayment(order.id);
  redirect(`/commande/${order.ref}/paiement`);
}

async function startPayment(orderId: string) {
  const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
  const provider = getPaymentProvider();
  const { providerRef } = await provider.requestPayment({
    orderRef: order.ref,
    msisdn: order.customerPhone,
    amountXaf: order.amountXaf,
  });
  await db.payment.create({
    data: {
      orderId: order.id,
      provider: provider.name,
      providerRef,
      msisdn: order.customerPhone,
      amountXaf: order.amountXaf,
    },
  });
}

export async function retryPayment(formData: FormData) {
  const ref = String(formData.get("ref"));
  const order = await db.order.findUnique({ where: { ref }, include: { payments: true } });
  if (!order || order.status !== "PENDING_PAYMENT") redirect(`/commande/${ref}`);
  await db.payment.updateMany({ where: { orderId: order.id, status: "PENDING" }, data: { status: "FAILED" } });
  await startPayment(order.id);
  redirect(`/commande/${ref}/paiement`);
}

// Mode test uniquement : remplace la validation par code PIN sur le téléphone.
export async function simulatePayment(formData: FormData) {
  if (!getPaymentProvider().isTestMode) throw new Error("Simulation interdite hors mode test");
  const ref = String(formData.get("ref"));
  const outcome = formData.get("outcome") === "SUCCESS" ? "SUCCESS" : "FAILED";
  const payment = await db.payment.findFirst({
    where: { order: { ref }, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (payment) await applyPaymentResult(payment.id, outcome);
  redirect(outcome === "SUCCESS" ? `/commande/${ref}` : `/commande/${ref}/paiement`);
}

export async function cancelUnpaidOrder(formData: FormData) {
  const ref = String(formData.get("ref"));
  await db.order.updateMany({
    where: { ref, status: "PENDING_PAYMENT" },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });
  redirect(`/commande/${ref}`);
}

const ratingSchema = z.object({
  ref: z.string(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function rateDelivery(formData: FormData) {
  const parsed = ratingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/commande/${formData.get("ref")}`);
  const { ref, rating, comment } = parsed.data;
  const order = await db.order.findUnique({ where: { ref } });
  if (order && order.status === "DELIVERED" && order.rating === null && order.supplierId) {
    await db.$transaction([
      db.order.update({ where: { id: order.id }, data: { rating, ratingComment: comment || null } }),
      db.supplier.update({
        where: { id: order.supplierId },
        data: { ratingSum: { increment: rating }, ratingCount: { increment: 1 } },
      }),
    ]);
  }
  revalidatePath(`/commande/${ref}`);
}

export async function reportIssue(formData: FormData) {
  const ref = String(formData.get("ref"));
  const issue = String(formData.get("issue") ?? "").trim().slice(0, 1000);
  if (issue) await db.order.update({ where: { ref }, data: { issue } });
  revalidatePath(`/commande/${ref}`);
}

export async function findOrder(formData: FormData) {
  const ref = String(formData.get("ref") ?? "").trim().toUpperCase().replace(/\s/g, "");
  if (!ref) redirect("/suivi");
  const order = await db.order.findUnique({ where: { ref } });
  redirect(order ? `/commande/${ref}` : `/suivi?introuvable=1`);
}
