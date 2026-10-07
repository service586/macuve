import { Alert, Card, PageTitle, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { findOrder } from "../commande/actions";

export default async function TrackPage({ searchParams }: PageProps<"/suivi">) {
  const { introuvable } = await searchParams;
  return (
    <div className="mx-auto max-w-md">
      <PageTitle subtitle="Le numéro de commande figure dans le SMS reçu après le paiement.">Suivre ma commande</PageTitle>
      <Card>
        <form action={findOrder} className="space-y-4">
          {introuvable && <Alert>Aucune commande ne porte ce numéro.</Alert>}
          <div>
            <label className={labelClass} htmlFor="ref">
              Numéro de commande
            </label>
            <input id="ref" name="ref" className={`${inputClass} uppercase`} placeholder="Ex. K7PQ2M9X" required />
          </div>
          <SubmitButton>Voir ma commande</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
