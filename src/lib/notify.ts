import { db } from "./db";

// Boîte d'envoi SMS. En mode test, les messages restent dans la base et sont
// visibles par l'administrateur. Un fournisseur SMS sera branché ici plus tard.
export async function sendSms(to: string, message: string) {
  await db.notification.create({ data: { to, message } });
}
