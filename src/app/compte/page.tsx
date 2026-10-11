import Link from "next/link";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate, formatLiters, formatXaf } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Card, PageTitle, StatusBadge, buttonClass, inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { logout } from "../auth/actions";
import { updateName } from "./actions";

export default async function CustomerAccountPage() {
  const user = await requireRole("CUSTOMER");
  // Le numéro a été vérifié par SMS : les commandes passées avec lui, même sans compte, sont les siennes.
  const orders = await db.order.findMany({
    where: { OR: [{ customerId: user.id }, { customerPhone: user.phone }], status: { not: "CANCELLED" } },
    include: { zone: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const delivered = orders.filter((o) => o.status === "DELIVERED");
  const totalLiters = delivered.reduce((sum, o) => sum + o.liters, 0);
  const totalSpent = delivered.reduce((sum, o) => sum + o.amountXaf, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageTitle subtitle={displayPhone(user.phone)}>{user.name || "Mon compte"}</PageTitle>
        <form action={logout}>
          <SubmitButton className={secondaryButtonClass}>Se déconnecter</SubmitButton>
        </form>
      </div>

      {!user.name && (
        <Card>
          <form action={updateName} className="space-y-3">
            <label className={labelClass} htmlFor="name">
              Comment vous appelez-vous ?
            </label>
            <div className="flex gap-2">
              <input id="name" name="name" className={inputClass} autoComplete="name" minLength={2} required />
              <SubmitButton>Enregistrer</SubmitButton>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Livraisons</div>
          <div className="font-bold">{delivered.length}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Eau reçue</div>
          <div className="font-bold">{formatLiters(totalLiters)}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Dépensé</div>
          <div className="font-bold">{formatXaf(totalSpent)}</div>
        </Card>
      </div>

      <Link href="/" className={`${buttonClass} w-full`}>
        Commander de l&apos;eau
      </Link>

      <section>
        <h2 className="mb-3 text-lg font-bold">Mes commandes</h2>
        {orders.length === 0 && <p className="text-slate-500">Aucune commande pour l&apos;instant.</p>}
        <div className="space-y-3">
          {orders.map((o) => (
            <Link key={o.id} href={`/commande/${o.ref}`} className="block">
              <Card className="flex items-center justify-between gap-3 transition hover:border-sky-300">
                <div>
                  <div className="font-bold">
                    {formatLiters(o.liters)} · {formatXaf(o.amountXaf)}
                  </div>
                  <div className="text-sm text-slate-600">
                    {o.neighborhood}, {o.zone.name} · {formatDate(o.createdAt)}
                  </div>
                  {o.rating !== null && <div className="text-sm text-amber-700">{"★".repeat(o.rating)}</div>}
                </div>
                <StatusBadge status={o.status} />
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
