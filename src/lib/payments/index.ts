import { mockProvider } from "./mock";
import { isMyPayGaSandbox, myPayGaProvider } from "./mypayga";
import type { PaymentProvider } from "./types";

const providers: Record<string, PaymentProvider> = {
  mock: mockProvider,
  mypayga: myPayGaProvider,
};

export function getPaymentProvider(name = process.env.PAYMENT_PROVIDER ?? "mock"): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Prestataire de paiement inconnu : ${name}`);
  return provider;
}

// Texte du bandeau affiché en haut du site quand aucun argent réel ne circule.
export function paymentModeBanner(): string | null {
  const name = process.env.PAYMENT_PROVIDER ?? "mock";
  if (name === "mock") return "Mode test : aucun paiement réel n'est effectué";
  if (name === "mypayga" && isMyPayGaSandbox()) return "Mode test MyPayGa : seuls les numéros de test sont débités";
  return null;
}

export type { PaymentProvider } from "./types";
