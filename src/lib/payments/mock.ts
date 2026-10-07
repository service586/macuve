import { randomUUID } from "node:crypto";
import { db } from "../db";
import type { PaymentProvider } from "./types";

// Mode test : aucun argent ne circule. Le client valide ou refuse le paiement
// sur une page de simulation qui remplace l'invite USSD.
export const mockProvider: PaymentProvider = {
  name: "mock",
  isTestMode: true,

  async requestPayment() {
    return { providerRef: `MOCK-${randomUUID()}` };
  },

  async checkStatus(providerRef) {
    const payment = await db.payment.findFirst({ where: { providerRef } });
    return payment?.status ?? "FAILED";
  },

  async parseWebhook(body) {
    const data = body as { providerRef?: string; status?: string } | null;
    if (!data?.providerRef || (data.status !== "SUCCESS" && data.status !== "FAILED")) return null;
    return { providerRef: data.providerRef, status: data.status };
  },

  async refund() {
    return { ok: true, providerRef: `MOCK-REFUND-${randomUUID()}` };
  },

  async payout() {
    return { ok: true, providerRef: `MOCK-PAYOUT-${randomUUID()}` };
  },
};
