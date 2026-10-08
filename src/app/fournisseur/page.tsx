import { db } from "@/lib/db";
import { requireSupplier } from "@/lib/auth";
import { formatDate, formatLiters, formatXaf } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Alert, Card, PageTitle, StatusBadge, inputClass, secondaryButtonClass, smallButtonClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { AutoRefresh } from "../commande/[ref]/AutoRefresh";
import { logout } from "../auth/actions";
import { acceptOfferAction, acceptOrder, confirmDelivery, declineOfferAction, startDelivery } from "./actions";
import { advanceDispatch } from "@/lib/dispatch";
import { directionsUrl, formatDistance } from "@/lib/geo";
import { DriverPanel } from "./DriverPanel";
import { Countdown } from "./Countdown";

export default async function SupplierDashboard({ searchParams }: PageProps<"/fournisseur">) {
  const { user, supplier } = await requireSupplier();
  const query = await searchParams;

  const header = (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <PageTitle subtitle={`${user.name} · ${displayPhone(user.phone)}`}>{supplier.businessName}</PageTitle>
      <form action={logout}>
        <SubmitButton className={secondaryButtonClass}>Se déconnecter</SubmitButton>
      </form>
    </div>
  );

  if (supplier.status !== "APPROVED") {
    return (
      <div className="mx-auto max-w-2xl">
        {header}
        <Alert kind="info">
          {supplier.status === "PENDING"
            ? "Votre inscription est en cours de vérification. Vous recevrez un SMS dès que votre compte sera activé."
            : "Votre compte est suspendu. Contactez MaCuve pour en savoir plus."}
        </Alert>
      </div>
    );
  }

  await advanceDispatch();
  const [offer, available, mine, delivered] = await Promise.all([
    db.orderOffer.findFirst({
      where: { supplierId: supplier.id, status: "PENDING" },
      include: { order: { include: { zone: true } } },
    }),
    db.order.findMany({
      where: {
        status: "PAID",
        supplierId: null,
        openedToAllAt: { not: null },
        zone: { suppliers: { some: { supplierId: supplier.id } } },
      },
      include: { zone: true },
      orderBy: { paidAt: "asc" },
    }),
    db.order.findMany({
      where: { supplierId: supplier.id, status: { in: ["ACCEPTED", "EN_ROUTE"] } },
      include: { zone: true },
      orderBy: { acceptedAt: "asc" },
    }),
    db.order.findMany({
      where: { supplierId: supplier.id, status: "DELIVERED" },
      include: { payout: true },
      orderBy: { deliveredAt: "desc" },
      take: 50,
    }),
  ]);

  const net = (o: { amountXaf: number; commissionXaf: number }) => o.amountXaf - o.commissionXaf;
  const toBePaid = delivered.filter((o) => o.payout?.status !== "PAID").reduce((s, o) => s + net(o), 0);
  const rating = supplier.ratingCount ? (supplier.ratingSum / supplier.ratingCount).toFixed(1) : "—";

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={10} />
      {header}

      <DriverPanel available={supplier.available} tracking={supplier.available || mine.length > 0} />

      {query.deja_prise && <Alert>Cette commande a déjà été prise par un autre livreur.</Alert>}
      {query.trop_tard && <Alert>Trop tard : le temps pour accepter était écoulé, la commande est passée à un autre livreur.</Alert>}

      {offer && (
        <section className="space-y-3 rounded-2xl border-2 border-amber-400 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold">🔔 Nouvelle commande pour vous</h2>
            <span className="text-sm text-amber-900">
              Reste <Countdown until={offer.expiresAt.toISOString()} />
            </span>
          </div>
          <div>
            <div className="text-2xl font-bold">
              {formatLiters(offer.order.liters)} · {formatXaf(net(offer.order))} pour vous
            </div>
            <div className="text-sm text-slate-700">
              À {formatDistance(offer.distanceM)} de vous · {offer.order.neighborhood}, {offer.order.zone.name} · {offer.order.slot}
            </div>
          </div>
          <div className="flex gap-3">
            <form action={acceptOfferAction} className="flex-1">
              <input type="hidden" name="offerId" value={offer.id} />
              <SubmitButton className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold text-white hover:bg-emerald-700">
                Accepter
              </SubmitButton>
            </form>
            <form action={declineOfferAction}>
              <input type="hidden" name="offerId" value={offer.id} />
              <SubmitButton className={secondaryButtonClass}>Refuser</SubmitButton>
            </form>
          </div>
        </section>
      )}
      {query.livree && <Alert kind="success">Livraison confirmée. Le montant sera ajouté à votre prochain reversement.</Alert>}

      <div className="grid grid-cols-3 gap-3 text-center">
        <Card className="!p-3">
          <div className="text-xs text-slate-500">À recevoir</div>
          <div className="font-bold">{formatXaf(toBePaid)}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Livraisons</div>
          <div className="font-bold">{delivered.length}</div>
        </Card>
        <Card className="!p-3">
          <div className="text-xs text-slate-500">Note</div>
          <div className="font-bold">{rating} ★</div>
        </Card>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-bold">Mes livraisons en cours</h2>
        {mine.length === 0 && <p className="text-slate-500">Aucune livraison en cours.</p>}
        <div className="space-y-3">
          {mine.map((o) => (
            <Card key={o.id} className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{formatLiters(o.liters)}</span>
                <StatusBadge status={o.status} />
              </div>
              <div className="text-sm">
                <div>
                  <strong>{o.neighborhood}</strong>, {o.zone.name} · {o.slot}
                </div>
                <div className="text-slate-600">{o.landmark}</div>
                {o.lat !== null && o.lng !== null && (
                  <a
                    className="font-semibold text-sky-700 underline"
                    href={directionsUrl({ lat: o.lat, lng: o.lng })}
                    target="_blank"
                    rel="noreferrer"
                  >
                    🧭 Itinéraire vers le client
                  </a>
                )}
                <div>
                  {o.customerName} ·{" "}
                  <a className="text-sky-700 underline" href={`tel:${o.customerPhone}`}>
                    {displayPhone(o.customerPhone)}
                  </a>
                </div>
              </div>
              {o.status === "ACCEPTED" ? (
                <form action={startDelivery}>
                  <input type="hidden" name="orderId" value={o.id} />
                  <SubmitButton className={smallButtonClass}>Je pars livrer</SubmitButton>
                </form>
              ) : (
                <form action={confirmDelivery} className="space-y-2">
                  {query.code_faux === o.id && <Alert>Code incorrect. Demandez au client le code reçu par SMS.</Alert>}
                  <input type="hidden" name="orderId" value={o.id} />
                  <div className="flex gap-2">
                    <input
                      name="code"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="Code client"
                      className={`${inputClass} max-w-36 font-mono tracking-widest`}
                      required
                    />
                    <SubmitButton className={smallButtonClass}>Confirmer la livraison</SubmitButton>
                  </div>
                </form>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-bold">Commandes ouvertes à tous</h2>
        <p className="mb-3 text-sm text-slate-500">Commandes qu&apos;aucun livreur proche n&apos;a pu prendre : le premier qui accepte les livre.</p>
        {available.length === 0 && <p className="text-slate-500">Aucune commande en attente dans vos communes.</p>}
        <div className="space-y-3">
          {available.map((o) => (
            <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-lg font-bold">
                  {formatLiters(o.liters)} · {formatXaf(net(o))} pour vous
                </div>
                <div className="text-sm text-slate-600">
                  {o.neighborhood}, {o.zone.name} · {o.slot} · payée {formatDate(o.paidAt)}
                </div>
                {o.liters > supplier.tankCapacityL && (
                  <div className="text-sm text-amber-700">Plus que la capacité de votre citerne</div>
                )}
              </div>
              <form action={acceptOrder}>
                <input type="hidden" name="orderId" value={o.id} />
                <SubmitButton className={smallButtonClass}>Accepter</SubmitButton>
              </form>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-bold">Historique</h2>
        {delivered.length === 0 ? (
          <p className="text-slate-500">Aucune livraison terminée.</p>
        ) : (
          <Card className="!p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-2">Livrée</th>
                  <th className="px-4 py-2">Volume</th>
                  <th className="px-4 py-2">Pour vous</th>
                  <th className="px-4 py-2">Reversement</th>
                </tr>
              </thead>
              <tbody>
                {delivered.map((o) => (
                  <tr key={o.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">{formatDate(o.deliveredAt)}</td>
                    <td className="px-4 py-2">{formatLiters(o.liters)}</td>
                    <td className="px-4 py-2">{formatXaf(net(o))}</td>
                    <td className="px-4 py-2">{o.payout?.status === "PAID" ? `Payé ${formatDate(o.payout.paidAt)}` : "À venir"}</td>
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
