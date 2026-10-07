import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatLiters } from "@/lib/format";
import { getCommissionPercent } from "@/lib/settings";
import { Alert, Card, PageTitle, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { savePricing } from "../../actions";

export default async function AdminPricingPage({ searchParams }: PageProps<"/admin/tarifs">) {
  await requireRole("ADMIN");
  const query = await searchParams;
  const [zones, tiers, prices, commission] = await Promise.all([
    db.zone.findMany({ orderBy: { sortOrder: "asc" } }),
    db.volumeTier.findMany({ orderBy: { liters: "asc" } }),
    db.price.findMany(),
    getCommissionPercent(),
  ]);
  const priceOf = (zoneId: string, tierId: string) => prices.find((p) => p.zoneId === zoneId && p.tierId === tierId)?.amountXaf;

  return (
    <form action={savePricing} className="space-y-5">
      <PageTitle subtitle="Prix payé par le client, livraison comprise, en FCFA. Une case vide rend le volume indisponible dans la commune.">
        Tarifs
      </PageTitle>
      {query.enregistre && <Alert kind="success">Tarifs enregistrés.</Alert>}
      {query.erreur && <Alert>La commission doit être comprise entre 0 et 50 %.</Alert>}

      <Card className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2">Commune</th>
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
