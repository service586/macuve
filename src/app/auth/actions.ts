"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/auth";
import { normalizeGabonPhone } from "@/lib/phone";

export type AuthState = { error?: string } | undefined;

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "SUPPLIER";
  const phone = normalizeGabonPhone(String(formData.get("phone") ?? ""));
  const password = String(formData.get("password") ?? "");
  const user = phone ? await db.user.findUnique({ where: { phone } }) : null;
  if (!user || user.role !== role || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Numéro ou mot de passe incorrect" };
  }
  await createSession(user.id);
  redirect(role === "ADMIN" ? "/admin" : "/fournisseur");
}

export async function logout() {
  await destroySession();
  redirect("/");
}
