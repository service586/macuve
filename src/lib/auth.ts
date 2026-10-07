import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";

const COOKIE = "macuve_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 16) throw new Error("SESSION_SECRET manquant ou trop court");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export async function createSession(userId: string) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  const store = await cookies();
  store.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(COOKIE);
}

async function readSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(COOKIE)?.value;
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const { uid, exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof uid !== "string" || typeof exp !== "number" || exp < Date.now() / 1000) return null;
    return uid;
  } catch {
    return null;
  }
}

export async function getCurrentUser() {
  const uid = await readSessionUserId();
  if (!uid) return null;
  return db.user.findUnique({ where: { id: uid }, include: { supplier: true } });
}

export async function requireRole(role: Role) {
  const user = await getCurrentUser();
  if (!user || user.role !== role) {
    redirect(role === "ADMIN" ? "/admin/connexion" : "/fournisseur/connexion");
  }
  return user;
}

export async function requireSupplier() {
  const user = await requireRole("SUPPLIER");
  if (!user.supplier) redirect("/fournisseur/connexion");
  return { user, supplier: user.supplier };
}
