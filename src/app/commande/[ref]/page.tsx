import Link from "next/link";
import { notFound } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { formatDate, formatLiters, formatXaf } from "@/lib/format";
import { displayPhone } from "@/lib/phone";
import { Alert, Card, PageTitle, StatusBadge, buttonClass, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { rateDelivery, reportIssue } from "../actions";
import { AutoRefresh } from "./AutoRefresh";
import { advanceDispatch } from "@/lib/dispatch";
import { distanceMeters, formatDistance } from "@/lib/geo";
import { MapView } from "@/components/MapView";

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: "PAID", label: "Payée" },
  { status: "ACCEPTED", label: "Livreur trouvé" },
  { status: "EN_ROUTE", label: "En route" },
  { status: "DELIVERED", label: "Livrée" },
];
const ORDER: OrderStatus[] = ["PENDING_PAYMENT", "PAID", "ACCEPTED", "EN_ROUTE", "DELIVERED"];

export default async function OrderPage({ params }: PageProps<"/commande/[ref]">) {
  const { ref } = await params;
  await advanceDispatch();
  const order = await db.order.findUnique({
    where: { ref },
    include: { zone: true, supplier: { include: { user: true } }, offers: { where: { status: "PENDING" } } },
  });
  if (!order) notFound();

  const home = order.lat !== null && order.lng !== null ? { lat: order.lat, lng: order.lng } : null;
  const supplier = order.supplier;
  const driver =
    supplier && supplier.lat !== null && supplier.lng !== null && (order.status === "ACCEPTED" || order.status === "EN_ROUTE")
      ? { lat: supplier.lat, lng: supplier.lng }
      : null;
  const pendingOffer = order.offers[0];

  const reached = ORDER.indexOf(order.status);
  const active = ["PAID", "ACCEPTED", "EN_ROUTE"].includes(order.status);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      {active && <AutoRefresh />}
      <PageTitle subtitle={`Commande ${order.ref}`}>
        {formatLiters(order.liters)} à {order.neighborhood}
      </PageTitle>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <StatusBadge status={order.status} />
          <span className="font-semibold">{formatXaf(order.amountXaf)}</span>
        </div>

        {reached >= 1 && (
          <ol className="grid grid-cols-4 gap-2 text-center text-xs">
            {STEPS.map((step) => {
              const done = ORDER.indexOf(step.status) <= reached;
              return (
                <li key={step.status}>
                  <div className={`mb-1 h-2 rounded-full ${done ? "bg-sky-600" : "bg-slate-200"}`} />
                  <span className={done ? "font-semibold text-slate-900" : "text-slate-400"}>{step.label}</span>
                </li>
              );
            })}
          </ol>
        )}

        {order.status === "PENDING_PAYMENT" && (
          <Link href={`/commande/${order.ref}/paiement`} className={buttonClass}>
            Finaliser le paiement
          </Link>
        )}

        {active && (
          <div className="rounded-xl bg-sky-50 p-4 text-center">
            <div className="text-sm text-sky-900">Code de livraison, à donner au livreur à son arrivée</div>
            <div className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-sky-900">{order.deliveryCode}</div>
          </div>
        )}

        {order.status === "PAID" && (
          <p className="text-sm text-slate-600">
            {pendingOffer
              ? `Votre commande est proposée au livreur disponible le plus proche, à ${formatDistance(pendingOffer.distanceM)} de chez vous. `
              : order.openedToAllAt
                ? "Aucun livreur n'est disponible tout près : tous les livreurs de votre commune ont été prévenus. "
                : "Nous cherchons le livreur disponible le plus proche. "}
            Cette page se met à jour toute seule.
          </p>
        )}

        {home && (order.status === "PAID" || driver) && (
          <div className="space-y-1">
            <MapView home={home} driver={driver} className="h-56" />
            {driver && (
              <p className="text-sm text-slate-600">
                🚚 Votre livreur est à {formatDistance(distanceMeters(home, driver))} à vol d&apos;oiseau
                {supplier?.locatedAt ? `, position du ${formatDate(supplier.locatedAt)}` : ""}.
              </p>
            )}
          </div>
        )}

        {supplier && (order.status === "ACCEPTED" || order.status === "EN_ROUTE") && (
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="text-sm text-slate-500">Votre livreur</div>
            <div className="font-semibold">{supplier.businessName}</div>
            <a href={`tel:${supplier.user.phone}`} className="text-sky-700 underline">
              {displayPhone(supplier.user.phone)}
            </a>
          </div>
        )}

        {order.status === "REFUNDED" && <Alert kind="info">Cette commande a été remboursée sur votre compte Airtel Money.</Alert>}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-slate-100 pt-4 text-sm">
          <dt className="text-slate-500">Adresse</dt>
          <dd>
            {order.neighborhood}, {order.zone.name}
          </dd>
          <dt className="text-slate-500">Repère</dt>
          <dd>{order.landmark}</dd>
          <dt className="text-slate-500">Créneau</dt>
          <dd>{order.slot}</dd>
          <dt className="text-slate-500">Commandée le</dt>
          <dd>{formatDate(order.createdAt)}</dd>
          {order.deliveredAt && (
            <>
              <dt className="text-slate-500">Livrée le</dt>
              <dd>{formatDate(order.deliveredAt)}</dd>
            </>
          )}
        </dl>
      </Card>

      {order.status === "DELIVERED" && order.rating === null && (
        <Card>
          <h2 className="mb-3 font-bold">Comment s&apos;est passée la livraison ?</h2>
          <form action={rateDelivery} className="space-y-3">
            <input type="hidden" name="ref" value={order.ref} />
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="rating" value={n} required className="peer sr-only" />
                  <span className="block rounded-lg border border-slate-300 px-3 py-2 text-lg peer-checked:border-amber-500 peer-checked:bg-amber-100">
                    {n} ★
                  </span>
                </label>
              ))}
            </div>
            <textarea name="comment" rows={2} className={inputClass} placeholder="Un commentaire ? (facultatif)" />
            <SubmitButton>Envoyer ma note</SubmitButton>
          </form>
        </Card>
      )}
      {order.rating !== null && <Alert kind="success">Merci pour votre note : {order.rating} ★</Alert>}

      {order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED" && (
        <Card>
          {order.issue ? (
            <Alert kind="info">Problème signalé : « {order.issue} ». Nous revenons vers vous.</Alert>
          ) : (
            <form action={reportIssue} className="space-y-3">
              <input type="hidden" name="ref" value={order.ref} />
              <label className={labelClass} htmlFor="issue">
                Un problème ? (eau sale, volume incomplet, retard…)
              </label>
              <textarea id="issue" name="issue" rows={2} className={inputClass} required />
              <SubmitButton className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-50">
                Signaler
              </SubmitButton>
            </form>
          )}
        </Card>
      )}
    </div>
  );
}
