"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { createSession, requireRole } from "@/lib/auth";
import { normalizeGabonPhone } from "@/lib/phone";
import { checkLoginCode, sendLoginCode } from "@/lib/loginCodes";
import { isSmsTestMode } from "@/lib/notify";

export type CodeState =
  | { step: "phone"; error?: string }
  | { step: "code"; phone: string; testCode?: string; error?: string };

export async function customerLogin(prev: CodeState, formData: FormData): Promise<CodeState> {
  if (formData.get("intent") === "restart") return { step: "phone" };

  if (prev.step === "phone" || formData.get("intent") === "resend") {
    const phone = normalizeGabonPhone(String(formData.get("phone") ?? (prev.step === "code" ? prev.phone : "")));
    if (!phone) return { step: "phone", error: "Numéro invalide. Exemple : 077 12 34 56" };
    const existing = await db.user.findUnique({ where: { phone } });
    if (existing && existing.role !== "CUSTOMER") {
      return { step: "phone", error: "Ce numéro est déjà utilisé par un compte livreur ou administrateur." };
    }
    const sent = await sendLoginCode(phone);
    if (!sent.ok) return prev.step === "code" ? { ...prev, error: sent.error } : { step: "phone", error: sent.error };
    return { step: "code", phone, testCode: isSmsTestMode() ? sent.code : undefined };
  }

  const { phone } = prev;
  const result = await checkLoginCode(phone, String(formData.get("code") ?? ""));
  if (!result.ok) return { ...prev, error: result.error };

  // Premier passage : le compte est créé, avec le nom de la dernière commande passée avec ce numéro.
  const lastOrder = await db.order.findFirst({ where: { customerPhone: phone }, orderBy: { createdAt: "desc" } });
  const user = await db.user.upsert({
    where: { phone },
    create: { phone, role: "CUSTOMER", name: lastOrder?.customerName ?? "" },
    update: {},
  });
  if (user.role !== "CUSTOMER") return { step: "phone", error: "Ce numéro est déjà utilisé par un compte livreur ou administrateur." };
  await createSession(user.id);
  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/compte");
}

export async function updateName(formData: FormData) {
  const user = await requireRole("CUSTOMER");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (name.length >= 2) await db.user.update({ where: { id: user.id }, data: { name } });
  revalidatePath("/compte");
}
