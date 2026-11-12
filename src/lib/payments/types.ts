export type ProviderPaymentStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface PaymentRequest {
  orderRef: string;
  msisdn: string;
  amountXaf: number;
  customerName?: string;
}

export interface TransferRequest {
  msisdn: string;
  amountXaf: number;
  reference: string;
}

export interface TransferResult {
  ok: boolean;
  providerRef?: string;
  error?: string;
}

// Chaque prestataire (MyPayGa, mock…) implémente cette
// interface ; le reste du site ne dépend que d'elle.
export interface PaymentProvider {
  name: string;
  isTestMode: boolean;
  // Envoie la demande de paiement (invite USSD sur le téléphone du client).
  requestPayment(req: PaymentRequest): Promise<{ providerRef: string }>;
  // Consultation du statut, en secours si l'appel de retour tarde.
  checkStatus(providerRef: string): Promise<ProviderPaymentStatus>;
  // Lit un appel de retour (webhook) du prestataire.
  // rawBody : texte brut reçu, utile quand la signature porte sur les valeurs telles qu'écrites.
  parseWebhook(
    body: unknown,
    headers: Headers,
    rawBody?: string,
  ): Promise<{ providerRef: string; status: ProviderPaymentStatus; amountXaf?: number } | null>;
  // Rembourse un client.
  refund(req: TransferRequest & { paymentRef: string }): Promise<TransferResult>;
  // Reverse de l'argent à un fournisseur.
  payout(req: TransferRequest): Promise<TransferResult>;
}
