import Link from "next/link";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { STATUS_LABELS, formatDate, formatLiters, formatXaf, hoursAgo, minutesSince } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Alert, Card, PageTitle, StatusBadge, dangerButtonClass, inputClass, smallButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { adminRefund, assignSupplier } from "../actions";

const FILTERS: (OrderStatus | "ACTIVE")[] = ["ACTIVE", "PAID", "ACCEPTED", "EN_ROUTE", "DELIVERED", "PENDING_PAYMENT", "REFUNDED", "CANCELLED"];

export default async function AdminOrdersPage({ searchParams }: PageProps<"/admin">) {
  await requireRole("ADMIN");
  const query = await searchParams;
  const filter = (FILTERS as string[]).includes(String(query.statut)) ? (query.statut as (typeof FILTERS)[number]) : "ACTIVE";
  const where =
    filter === "ACTIVE" ? { status: { in: ["PAID", "ACCEPTED", "EN_ROUTE"] as OrderStatus[] } } : { status: filter };

  const [orders, counts, suppliers, todayRevenue] = await Promise.all([
    db.order.findMany({
      where,
      include: { zone: true, supplier: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.order.groupBy({ by: ["status"], _count: true }),
    db.supplier.findMany({ where: { status: "APPROVED" }, include: { zones: true }, orderBy: { businessName: "asc" } }),
    db.order.aggregate({
      where: { status: "DELIVERED", deliveredAt: { gte: hoursAgo(24) } },
      _sum: { amountXaf: true, commissionXaf: true },
    }),
  ]);
  const count = (s: OrderStatus) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="space-y-5">
      <PageTitle>Commandes</PageTitle>
      {query.rembourse && <Alert kind="success">Commande remboursée.</Alert>}
      {query.erreur && <Alert>{String(query.erreur)}</Alert>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Sans livreur</div>
          <div className="text-xl font-bold">{count("PAID")}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">En cours</div>
          <div className="text-xl font-bold">{count("ACCEPTED") + count("EN_ROUTE")}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Livré (24 h)</div>
          <div className="text-xl font-bold">{formatXaf(todayRevenue._sum.amountXaf ?? 0)}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Commission (24 h)</div>
          <div className="text-xl font-bold">{formatXaf(todayRevenue._sum.commissionXaf ?? 0)}</div>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={`/admin?statut=${f}`}
            className={`rounded-full px-3 py-1 text-sm ${f === filter ? "bg-sky-700 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200"}`}
          >
            {f === "ACTIVE" ? "À suivre" : STATUS_LABELS[f]}
          </Link>
        ))}
      </div>

      {orders.length === 0 && <p className="text-slate-500">Aucune commande.</p>}
      <div className="space-y-3">
        {orders.map((o) => {
          const eligible = suppliers.filter((s) => s.zones.some((z) => z.zoneId === o.zoneId));
          return (
            <Card key={o.id} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-bold">
                  {o.ref} · {formatLiters(o.liters)} · {formatXaf(o.amountXaf)}
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="text-sm text-slate-600">
                {o.customerName} ({displayPhone(o.customerPhone)}) · {o.neighborhood}, {o.zone.name} · {o.slot} · créée{" "}
                {formatDate(o.createdAt)}
                {o.supplier && <> · Livreur : {o.supplier.businessName}</>}
                {o.status === "PAID" && (
                  <span className={minutesSince(o.paidAt) > 30 ? "font-semibold text-red-700" : ""}>
                    {" "}
                    · sans livreur depuis {minutesSince(o.paidAt)} min
                  </span>
                )}
              </div>
              {o.issue && <Alert>Problème signalé : {o.issue}</Alert>}
              {o.rating !== null && (
                <div className="text-sm">
                  Note : {o.rating} ★ {o.ratingComment && `« ${o.ratingComment} »`}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {o.status === "PAID" && eligible.length > 0 && (
                  <form action={assignSupplier} className="flex gap-2">
                    <input type="hidden" name="orderId" value={o.id} />
                    <select name="supplierId" className={`${inputClass} !py-1.5 text-sm`} required defaultValue="">
                      <option value="" disabled>
                        Attribuer à…
                      </option>
                      {eligible.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.businessName}
                        </option>
                      ))}
                    </select>
                    <SubmitButton className={smallButtonClass}>Attribuer</SubmitButton>
                  </form>
                )}
                {["PAID", "ACCEPTED", "EN_ROUTE"].includes(o.status) && (
                  <form action={adminRefund}>
                    <input type="hidden" name="orderId" value={o.id} />
                    <SubmitButton className={dangerButtonClass}>Rembourser</SubmitButton>
                  </form>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
