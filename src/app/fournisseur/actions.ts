"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, requireSupplier } from "@/lib/auth";
import { isAirtelNumber, normalizeGabonPhone } from "@/lib/phone";
import { formatLiters } from "@/lib/format";
import { sendSms } from "@/lib/notify";

export type FormState = { error?: string } | undefined;

const registerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom"),
  businessName: z.string().trim().min(2, "Indiquez le nom de votre activité"),
  phone: z.string().trim().min(8, "Indiquez votre numéro"),
  airtelNumber: z.string().trim().min(8, "Indiquez votre numéro Airtel Money"),
  password: z.string().min(6, "Le mot de passe doit faire au moins 6 caractères"),
  tankCapacityL: z.coerce.number().int().min(500, "Capacité de citerne invalide").max(60000, "Capacité de citerne invalide"),
  waterSource: z.enum(["FORAGE", "SEEG", "AUTRE"]),
});

export async function registerSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;
  const zoneIds = formData.getAll("zoneIds").map(String);
  if (zoneIds.length === 0) return { error: "Choisissez au moins une commune desservie" };

  const phone = normalizeGabonPhone(input.phone);
  const airtel = normalizeGabonPhone(input.airtelNumber);
  if (!phone) return { error: "Numéro de téléphone invalide" };
  if (!airtel || !isAirtelNumber(airtel)) return { error: "Le numéro de reversement doit être un numéro Airtel (074, 076 ou 077)" };
  if (await db.user.findUnique({ where: { phone } })) return { error: "Ce numéro a déjà un compte. Connectez-vous." };

  const user = await db.user.create({
    data: {
      name: input.name,
      phone,
      role: "SUPPLIER",
      passwordHash: await bcrypt.hash(input.password, 10),
      supplier: {
        create: {
          businessName: input.businessName,
          airtelNumber: airtel,
          tankCapacityL: input.tankCapacityL,
          waterSource: input.waterSource,
          zones: { create: zoneIds.map((zoneId) => ({ zoneId })) },
        },
      },
    },
  });
  await createSession(user.id);
  redirect("/fournisseur");
}

export async function acceptOrder(formData: FormData) {
  const { supplier } = await requireSupplier();
  if (supplier.status !== "APPROVED") redirect("/fournisseur");
  const orderId = String(formData.get("orderId"));

  // Le premier livreur qui accepte prend la commande.
  const updated = await db.order.updateMany({
    where: { id: orderId, status: "PAID", supplierId: null, zone: { suppliers: { some: { supplierId: supplier.id } } } },
    data: { status: "ACCEPTED", supplierId: supplier.id, acceptedAt: new Date() },
  });
  if (updated.count === 0) redirect("/fournisseur?deja_prise=1");

  const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { supplier: { include: { user: true } } } });
  await sendSms(
    order.customerPhone,
    `MaCuve : ${order.supplier!.businessName} (${order.supplier!.user.phone}) va livrer vos ${formatLiters(order.liters)}. Commande ${order.ref}.`,
  );
  revalidatePath("/fournisseur");
}

export async function startDelivery(formData: FormData) {
  const { supplier } = await requireSupplier();
  const orderId = String(formData.get("orderId"));
  const updated = await db.order.updateMany({
    where: { id: orderId, supplierId: supplier.id, status: "ACCEPTED" },
    data: { status: "EN_ROUTE", enRouteAt: new Date() },
  });
  if (updated.count > 0) {
    const order = await db.order.findUniqueOrThrow({ where: { id: orderId } });
    await sendSms(order.customerPhone, `MaCuve : votre livreur est en route. Préparez votre code de livraison : ${order.deliveryCode}.`);
  }
  revalidatePath("/fournisseur");
}

export async function confirmDelivery(formData: FormData) {
  const { supplier } = await requireSupplier();
  const orderId = String(formData.get("orderId"));
  const code = String(formData.get("code") ?? "").trim();
  const order = await db.order.findFirst({ where: { id: orderId, supplierId: supplier.id, status: "EN_ROUTE" } });
  if (!order) redirect("/fournisseur");
  if (order.deliveryCode !== code) redirect(`/fournisseur?code_faux=${order.id}`);

  await db.order.update({ where: { id: order.id }, data: { status: "DELIVERED", deliveredAt: new Date() } });
  await sendSms(
    order.customerPhone,
    `MaCuve : livraison de ${formatLiters(order.liters)} confirmée. Merci ! Notez votre livreur : commande ${order.ref}.`,
  );
  redirect("/fournisseur?livree=1");
}
