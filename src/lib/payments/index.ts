import { mockProvider } from "./mock";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  // pvit: pvitProvider,       à ajouter une fois le contrat signé
  // ebilling: ebillingProvider,
};

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER ?? "mock"): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Prestataire de paiement inconnu : ${name}`);
  return provider;
}

export type { PaymentProvider } from "./types";
