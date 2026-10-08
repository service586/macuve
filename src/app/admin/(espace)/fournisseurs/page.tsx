import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { formatDate, formatLiters } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Card, PageTitle, dangerButtonClass, smallButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { setSupplierStatus } from "../../actions";

const STATUS = { PENDING: "À valider", APPROVED: "Actif", SUSPENDED: "Suspendu" } as const;
const SOURCE = { FORAGE: "Forage", SEEG: "SEEG", AUTRE: "Autre" } as const;

export default async function AdminSuppliersPage() {
  await requireRole("ADMIN");
  const suppliers = await db.supplier.findMany({
    include: { user: true, zones: { include: { zone: true } }, _count: { select: { orders: { where: { status: "DELIVERED" } } } } },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="space-y-4">
      <PageTitle subtitle="Vérifiez l'identité, la citerne et l'origine de l'eau avant d'activer un livreur.">Livreurs</PageTitle>
      {suppliers.length === 0 && <p className="text-slate-500">Aucun livreur inscrit.</p>}
      {suppliers.map((s) => (
        <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 text-sm">
            <div className="text-base font-bold">
              {s.businessName} <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold">{STATUS[s.status]}</span>
              {s.status === "APPROVED" && s.available && (
                <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">Disponible</span>
              )}
            </div>
            <div>
              {s.user.name} · {displayPhone(s.user.phone)} · Airtel Money {displayPhone(s.airtelNumber)}
            </div>
            <div className="text-slate-600">
              Citerne {formatLiters(s.tankCapacityL)} · eau : {SOURCE[s.waterSource]} · {s.zones.map((z) => z.zone.name).join(", ")}
            </div>
            <div className="text-slate-600">
              {s._count.orders} livraison(s) · note {s.ratingCount ? (s.ratingSum / s.ratingCount).toFixed(1) : "—"} ★ · inscrit{" "}
              {formatDate(s.createdAt)}
            </div>
          </div>
          <div className="flex gap-2">
            {s.status !== "APPROVED" && (
              <form action={setSupplierStatus}>
                <input type="hidden" name="supplierId" value={s.id} />
                <input type="hidden" name="status" value="APPROVED" />
                <SubmitButton className={smallButtonClass}>{s.status === "PENDING" ? "Valider" : "Réactiver"}</SubmitButton>
              </form>
            )}
            {s.status !== "SUSPENDED" && (
              <form action={setSupplierStatus}>
                <input type="hidden" name="supplierId" value={s.id} />
                <input type="hidden" name="status" value="SUSPENDED" />
                <SubmitButton className={dangerButtonClass}>Suspendre</SubmitButton>
              </form>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
