import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { isSmsTestMode, sendSms } from "./notify";

const CODE_MINUTES = 10;
const MAX_ATTEMPTS = 5;
// Au plus 3 codes par numéro sur 15 minutes, pour limiter les abus (et le coût des SMS).
const MAX_CODES = 3;
const WINDOW_MINUTES = 15;

function hash(phone: string, code: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET manquant");
  return createHmac("sha256", secret).update(`${phone}:${code}`).digest("hex");
}

export async function sendLoginCode(phone: string): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  const recent = await db.loginCode.count({
    where: { phone, createdAt: { gte: new Date(Date.now() - WINDOW_MINUTES * 60 * 1000) } },
  });
  if (recent >= MAX_CODES) return { ok: false, error: "Trop de codes demandés. Réessayez dans quelques minutes." };

  const code = String(randomInt(1_000_000)).padStart(6, "0");
  await db.loginCode.create({
    data: { phone, codeHash: hash(phone, code), expiresAt: new Date(Date.now() + CODE_MINUTES * 60 * 1000) },
  });
  const sent = await sendSms(phone, `MaCuve : votre code de connexion est ${code}. Il expire dans ${CODE_MINUTES} minutes. Ne le donnez à personne.`);
  if (!sent && !isSmsTestMode()) return { ok: false, error: "Le SMS n'a pas pu partir. Réessayez dans un instant." };
  return { ok: true, code };
}

export async function checkLoginCode(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  const row = await db.loginCode.findFirst({
    where: { phone, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, error: "Code expiré. Demandez-en un nouveau." };
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, error: "Trop d'essais. Demandez un nouveau code." };

  const expected = Buffer.from(row.codeHash);
  const given = Buffer.from(hash(phone, code.trim()));
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Code incorrect." };
  }
  // Le code ne sert qu'une fois, même si deux requêtes arrivent en même temps.
  const used = await db.loginCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return used.count === 1 ? { ok: true } : { ok: false, error: "Code déjà utilisé. Demandez-en un nouveau." };
}
