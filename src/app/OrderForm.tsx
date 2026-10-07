"use client";

import { useActionState, useMemo, useState } from "react";
import { createOrder } from "./commande/actions";
import { Alert, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatLiters, formatXaf } from "@/lib/format";

type Zone = { id: string; name: string; neighborhoods: string[] };
type Tier = { id: string; liters: number };
type Price = { zoneId: string; tierId: string; amountXaf: number };

const SLOTS = ["Dès que possible", "Aujourd'hui", "Demain matin", "Demain après-midi"];

export function OrderForm({ zones, tiers, prices }: { zones: Zone[]; tiers: Tier[]; prices: Price[] }) {
  const [state, action] = useActionState(createOrder, undefined);
  const [zoneId, setZoneId] = useState(zones[0]?.id ?? "");
  const [tierId, setTierId] = useState(tiers[1]?.id ?? tiers[0]?.id ?? "");
  const zone = zones.find((z) => z.id === zoneId);
  const priceFor = useMemo(
    () => (tid: string) => prices.find((p) => p.zoneId === zoneId && p.tierId === tid)?.amountXaf,
    [prices, zoneId],
  );
  const total = priceFor(tierId);

  return (
    <form action={action} className="space-y-5">
      {state?.error && <Alert>{state.error}</Alert>}

      <div>
        <label className={labelClass} htmlFor="zoneId">
          Commune
        </label>
        <select id="zoneId" name="zoneId" className={inputClass} value={zoneId} onChange={(e) => setZoneId(e.target.value)}>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {z.name}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Volume d&apos;eau</legend>
        <div className="grid grid-cols-2 gap-3">
          {tiers.map((t) => {
            const price = priceFor(t.id);
            const selected = t.id === tierId;
            return (
              <label
                key={t.id}
                className={`cursor-pointer rounded-xl border-2 p-3 text-center transition ${
                  selected ? "border-sky-600 bg-sky-50" : "border-slate-200 bg-white hover:border-slate-300"
                } ${price === undefined ? "opacity-40" : ""}`}
              >
                <input
                  type="radio"
                  name="tierId"
                  value={t.id}
                  checked={selected}
                  disabled={price === undefined}
                  onChange={() => setTierId(t.id)}
                  className="sr-only"
                />
                <span className="block text-lg font-bold text-slate-900">{formatLiters(t.liters)}</span>
                <span className="block text-sm text-slate-600">{price !== undefined ? formatXaf(price) : "Indisponible"}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label className={labelClass} htmlFor="neighborhood">
          Quartier
        </label>
        <input id="neighborhood" name="neighborhood" list="neighborhoods" className={inputClass} placeholder="Ex. Nzeng-Ayong" required />
        <datalist id="neighborhoods">
          {zone?.neighborhoods.map((n) => <option key={n} value={n} />)}
        </datalist>
      </div>

      <div>
        <label className={labelClass} htmlFor="landmark">
          Repère pour trouver votre domicile
        </label>
        <textarea
          id="landmark"
          name="landmark"
          rows={2}
          className={inputClass}
          placeholder="Ex. Derrière la pharmacie, portail bleu"
          required
        />
      </div>

      <div>
        <label className={labelClass} htmlFor="slot">
          Quand ?
        </label>
        <select id="slot" name="slot" className={inputClass} defaultValue={SLOTS[0]}>
          {SLOTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="customerName">
            Votre nom
          </label>
          <input id="customerName" name="customerName" className={inputClass} autoComplete="name" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">
            Numéro Airtel Money
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className={inputClass}
            placeholder="077 12 34 56"
            autoComplete="tel"
            required
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-slate-900 px-4 py-4 text-white">
        <div>
          <div className="text-sm text-slate-300">Total, livraison comprise</div>
          <div className="text-2xl font-bold">{total !== undefined ? formatXaf(total) : "—"}</div>
        </div>
        <SubmitButton className="rounded-lg bg-amber-400 px-5 py-3 font-bold text-slate-900 hover:bg-amber-300 disabled:opacity-60" pendingText="Envoi…">
          Payer avec Airtel Money
        </SubmitButton>
      </div>
    </form>
  );
}
