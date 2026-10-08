import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatLiters } from "@/lib/format";
import { getCommissionPercent, getOfferSeconds } from "@/lib/settings";
import { Alert, Card, PageTitle, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { savePricing } from "../../actions";

export default async function AdminPricingPage({ searchParams }: PageProps<"/admin/tarifs">) {
  await requireRole("ADMIN");
  const query = await searchParams;
  const [zones, tiers, prices, commission, offerSeconds] = await Promise.all([
    db.zone.findMany({ orderBy: { sortOrder: "asc" } }),
    db.volumeTier.findMany({ orderBy: { liters: "asc" } }),
    db.price.findMany(),
    getCommissionPercent(),
    getOfferSeconds(),
  ]);
  const priceOf = (zoneId: string, tierId: string) => prices.find((p) => p.zoneId === zoneId && p.tierId === tierId)?.amountXaf;

  return (
    <form action={savePricing} className="space-y-5">
      <PageTitle subtitle="Prix payé par le client, livraison comprise, en FCFA. Une case vide rend le volume indisponible dans la commune. Décochez « Ouverte » pour fermer une commune aux commandes.">
        Tarifs
      </PageTitle>
      {query.enregistre && <Alert kind="success">Tarifs enregistrés.</Alert>}
      {query.erreur === "commission" && <Alert>La commission doit être comprise entre 0 et 50 %.</Alert>}
      {query.erreur === "delai" && <Alert>Le temps pour accepter doit être compris entre 30 et 900 secondes.</Alert>}

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Commune</th>
              <th className="px-2 py-2">Ouverte</th>
              {tiers.map((t) => (
                <th key={t.id} className="px-2 py-2">
                  {formatLiters(t.liters)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.id} className="border-t border-slate-100">
                <td className="px-4 py-2 font-semibold">{z.name}</td>
                <td className="px-2 py-2 text-center">
                  <input
                    type="checkbox"
                    name={`active:${z.id}`}
                    defaultChecked={z.active}
                    aria-label={`${z.name} ouverte aux commandes`}
                    className="h-5 w-5 accent-sky-700"
                  />
                </td>
                {tiers.map((t) => (
                  <td key={t.id} className="px-2 py-2">
                    <input
                      name={`price:${z.id}:${t.id}`}
                      type="number"
                      min={0}
                      step={500}
                      defaultValue={priceOf(z.id, t.id)}
                      aria-label={`${z.name} ${formatLiters(t.liters)}`}
                      className={`${inputClass} !py-1.5 min-w-24`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="space-y-4">
        <div className="max-w-xs">
          <label className={labelClass} htmlFor="commissionPercent">
            Commission MaCuve (% de chaque commande)
          </label>
          <input
            id="commissionPercent"
            name="commissionPercent"
            type="number"
            min={0}
            max={50}
            step={0.5}
            defaultValue={commission}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">S&apos;applique aux nouvelles commandes seulement.</p>
        </div>
        <div className="max-w-xs">
          <label className={labelClass} htmlFor="offerSeconds">
            Temps laissé au livreur le plus proche pour accepter (secondes)
          </label>
          <input
            id="offerSeconds"
            name="offerSeconds"
            type="number"
            min={30}
            max={900}
            step={10}
            defaultValue={offerSeconds}
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">Passé ce délai, la commande est proposée au livreur suivant.</p>
        </div>
        {zones.map((z) => (
          <div key={z.id}>
            <label className={labelClass} htmlFor={`n-${z.id}`}>
              Quartiers proposés pour {z.name} (séparés par des virgules)
            </label>
            <input id={`n-${z.id}`} name={`neighborhoods:${z.id}`} defaultValue={z.neighborhoods.join(", ")} className={inputClass} />
          </div>
        ))}
      </Card>
      <SubmitButton>Enregistrer</SubmitButton>
    </form>
  );
}
