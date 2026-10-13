import { db } from "./db";

// Boîte d'envoi SMS. Chaque message est gardé dans la base et visible par l'administrateur.
// Avec SMS_PROVIDER=twilio, il part aussi vraiment ; sinon (mode test) il reste dans la base.
export async function sendSms(to: string, message: string): Promise<boolean> {
  const row = await db.notification.create({ data: { to, message } });
  if (isSmsTestMode()) return false;
  try {
    await sendWithTwilio(to, message);
    await db.notification.update({ where: { id: row.id }, data: { sent: true } });
    return true;
  } catch (e) {
    // Un SMS qui ne part pas ne doit pas bloquer la commande : l'échec reste visible dans « SMS ».
    console.error("Échec d'envoi du SMS", row.id, e);
    return false;
  }
}

// Tant qu'aucun fournisseur SMS n'est branché, les SMS ne partent pas vraiment :
// le code de connexion est alors affiché à l'écran pour pouvoir tester.
export function isSmsTestMode(): boolean {
  return process.env.SMS_PROVIDER !== "twilio";
}

// Depuis 2024, les numéros gabonais ont 9 chiffres, le 0 compris : 077123456 devient +241077123456.
export function toInternational(phone: string): string {
  return `+241${phone}`;
}

async function sendWithTwilio(to: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  // Nom d'expéditeur validé (ex. « MaCuve ») ou numéro Twilio.
  const from = process.env.TWILIO_FROM;
  if (!sid || !token || !from) throw new Error("TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_FROM sont requis");
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}` },
    body: new URLSearchParams({ To: toInternational(to), From: from, Body: message }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Twilio ${res.status} : ${await res.text()}`);
}
