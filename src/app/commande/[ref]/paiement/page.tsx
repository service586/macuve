import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { formatLiters, formatXaf } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { getPaymentProvider } from "@/lib/payments";
import { Alert, Card, PageTitle, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { cancelUnpaidOrder, retryPayment, simulatePayment } from "../../actions";
import { PaymentWatcher } from "./PaymentWatcher";

export default async function PaymentPage({ params }: PageProps<"/commande/[ref]/paiement">) {
  const { ref } = await params;
  const order = await db.order.findUnique({
    where: { ref },
    include: { payments: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!order) notFound();
  if (order.status !== "PENDING_PAYMENT") redirect(`/commande/${ref}`);

  const payment = order.payments[0];
  const failed = payment?.status === "FAILED";
  const testMode = getPaymentProvider().isTestMode;

  return (
    <div className="mx-auto max-w-lg">
      <PageTitle subtitle={`Commande ${order.ref} · ${formatLiters(order.liters)}`}>Paiement Airtel Money</PageTitle>
      <Card className="space-y-5">
        <div className="text-center">
          <div className="text-sm text-slate-500">Montant</div>
          <div className="text-3xl font-bold">{formatXaf(order.amountXaf)}</div>
        </div>

        {failed ? (
          <Alert>Le paiement n&apos;a pas abouti (refusé, solde insuffisant ou délai dépassé). Vous pouvez réessayer.</Alert>
        ) : (
          <>
            <Alert kind="info">
              Une demande de paiement a été envoyée au <strong>{displayPhone(order.customerPhone)}</strong>. Validez-la sur
              votre téléphone avec votre code PIN Airtel Money.
            </Alert>
            <PaymentWatcher orderRef={order.ref} />
          </>
        )}

        {testMode && !failed && (
          <div className="rounded-xl border-2 border-dashed border-amber-400 bg-amber-50 p-4">
            <p className="mb-3 text-sm font-semibold text-amber-900">
              Mode test : simulez la réponse du client sur son téléphone.
            </p>
            <div className="flex flex-wrap gap-3">
              <form action={simulatePayment}>
                <input type="hidden" name="ref" value={order.ref} />
                <input type="hidden" name="outcome" value="SUCCESS" />
                <SubmitButton>Paiement validé</SubmitButton>
              </form>
              <form action={simulatePayment}>
                <input type="hidden" name="ref" value={order.ref} />
                <input type="hidden" name="outcome" value="FAILED" />
                <SubmitButton className={secondaryButtonClass}>Paiement refusé</SubmitButton>
              </form>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
          <form action={retryPayment}>
            <input type="hidden" name="ref" value={order.ref} />
            <SubmitButton className={secondaryButtonClass}>Renvoyer la demande</SubmitButton>
          </form>
          <form action={cancelUnpaidOrder}>
            <input type="hidden" name="ref" value={order.ref} />
            <SubmitButton className={secondaryButtonClass}>Annuler la commande</SubmitButton>
          </form>
        </div>
      </Card>
    </div>
  );
}
