import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card } from "@/components/ui";
import { OrderForm } from "./OrderForm";

export default async function Home() {
  await connection();
  const [zones, tiers, prices] = await Promise.all([
    db.zone.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.volumeTier.findMany({ where: { active: true }, orderBy: { liters: "asc" } }),
    db.price.findMany(),
  ]);

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.2fr]">
      <div className="space-y-5">
        <h1 className="text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">
          De l&apos;eau livrée chez vous, partout dans le Grand Libreville.
        </h1>
        <p className="text-lg text-slate-600">
          Choisissez un volume, payez par Airtel Money, et un livreur de citerne vérifié vous apporte l&apos;eau.
        </p>
        <ol className="space-y-3 text-slate-700">
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">1</span>
            Choisissez votre commune et le volume.
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">2</span>
            Validez le paiement Airtel Money sur votre téléphone.
          </li>
          <li className="flex gap-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-100 font-bold text-sky-800">3</span>
            Donnez votre code de livraison au livreur à son arrivée.
          </li>
        </ol>
        <p className="text-sm text-slate-500">
          Si aucun livreur ne prend votre commande ou si la livraison n&apos;a pas lieu, vous êtes remboursé.
        </p>
      </div>
      <Card>
        <h2 className="mb-4 text-xl font-bold">Commander de l&apos;eau</h2>
        <OrderForm
          zones={zones.map((z) => ({ id: z.id, name: z.name, neighborhoods: z.neighborhoods }))}
          tiers={tiers.map((t) => ({ id: t.id, liters: t.liters }))}
          prices={prices.map((p) => ({ zoneId: p.zoneId, tierId: p.tierId, amountXaf: p.amountXaf }))}
        />
      </Card>
    </div>
  );
}
