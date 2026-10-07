import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate, formatXaf } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Alert, Card, PageTitle, smallButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { runPayout } from "../../actions";

export default async function AdminPayoutsPage({ searchParams }: PageProps<"/admin/reversements">) {
  await requireRole("ADMIN");
  const query = await searchParams;
  const [pending, history] = await Promise.all([
    db.supplier.findMany({
      where: { orders: { some: { status: "DELIVERED", payoutId: null } } },
      include: { orders: { where: { status: "DELIVERED", payoutId: null } } },
    }),
    db.payout.findMany({ include: { supplier: true, _count: { select: { orders: true } } }, orderBy: { createdAt: "desc" }, take: 50 }),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle subtitle="Montant des livraisons confirmées, moins la commission, versé sur le compte Airtel Money du livreur.">
        Reversements
      </PageTitle>
      {query.verse && <Alert kind="success">Reversement effectué.</Alert>}
      {query.erreur && <Alert>{String(query.erreur)}</Alert>}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">À verser</h2>
        {pending.length === 0 && <p className="text-slate-500">Rien à verser pour le moment.</p>}
        {pending.map((s) => {
          const amount = s.orders.reduce((sum, o) => sum + o.amountXaf - o.commissionXaf, 0);
          return (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">{s.businessName}</div>
                <div className="text-sm text-slate-600">
                  {s.orders.length} livraison(s) · vers Airtel Money {displayPhone(s.airtelNumber)}
                </div>
              </div>
              <form action={runPayout} className="flex items-center gap-3">
                <span className="text-lg font-bold">{formatXaf(amount)}</span>
                <input type="hidden" name="supplierId" value={s.id} />
                <SubmitButton className={smallButtonClass}>Verser</SubmitButton>
              </form>
            </Card>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Historique</h2>
        {history.length === 0 ? (
          <p className="text-slate-500">Aucun reversement.</p>
        ) : (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Livreur</th>
                  <th className="px-4 py-2">Livraisons</th>
                  <th className="px-4 py-2">Montant</th>
                  <th className="px-4 py-2">Statut</th>
                </tr>
              </thead>
              <tbody>
                {history.map((p) => (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{formatDate(p.paidAt ?? p.createdAt)}</td>
                    <td className="px-4 py-2">{p.supplier.businessName}</td>
                    <td className="px-4 py-2">{p._count.orders}</td>
                    <td className="px-4 py-2">{formatXaf(p.amountXaf)}</td>
                    <td className="px-4 py-2">{{ PENDING: "En cours", PAID: "Versé", FAILED: "Échec" }[p.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
