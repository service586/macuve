"use client";

import { useActionState, useState } from "react";
import { createOrder } from "./commande/actions";
import { Alert, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { formatLiters, formatXaf } from "@/lib/format";
import { LocationPicker } from "./LocationPicker";
import { LITERS_STEP, MAX_LITERS, MIN_LITERS, isValidVolume, priceForVolume } from "@/lib/volumes";

type Zone = { id: string; name: string; neighborhoods: string[]; pricePer1000Xaf: number };

const SLOTS = ["Dès que possible", "Aujourd'hui", "Demain matin", "Demain après-midi"];

export type OrderDefaults = {
  name?: string;
  phone?: string;
  zoneId?: string;
  liters?: number;
  neighborhood?: string;
  landmark?: string;
  lat?: number | null;
  lng?: number | null;
};

export function OrderForm({
  zones,
  defaults = {},
}: {
  zones: Zone[];
  defaults?: OrderDefaults;
}) {
  const [state, action] = useActionState(createOrder, undefined);
  const [zoneId, setZoneId] = useState(
    defaults.zoneId && zones.some((z) => z.id === defaults.zoneId) ? defaults.zoneId : (zones[0]?.id ?? ""),
  );
  const [home] = useState(
    defaults.lat != null && defaults.lng != null ? { lat: defaults.lat, lng: defaults.lng } : null,
  );
  const [liters, setLiters] = useState(defaults.liters && isValidVolume(defaults.liters) ? defaults.liters : MIN_LITERS);
  const zone = zones.find((z) => z.id === zoneId);
  const total = zone ? priceForVolume(zone.pricePer1000Xaf, liters) : undefined;
  const tanks = liters / LITERS_STEP;

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
        <input type="hidden" name="liters" value={liters} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLiters((l) => Math.max(MIN_LITERS, l - LITERS_STEP))}
            disabled={liters <= MIN_LITERS}
            aria-label="Retirer 1000 L"
            className="h-12 w-12 shrink-0 rounded-xl border-2 border-slate-200 bg-white text-2xl font-bold text-sky-800 hover:border-sky-600 disabled:opacity-30"
          >
            −
          </button>
          <div className="flex-1 rounded-xl border-2 border-sky-600 bg-sky-50 px-3 py-2 text-center" aria-live="polite">
            <span className="block text-2xl font-bold text-slate-900">{formatLiters(liters)}</span>
            <span className="block text-sm text-slate-600">
              {tanks} {tanks > 1 ? "cuves" : "cuve"}
              {zone && ` × ${formatXaf(zone.pricePer1000Xaf)}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLiters((l) => Math.min(MAX_LITERS, l + LITERS_STEP))}
            disabled={liters >= MAX_LITERS}
            aria-label="Ajouter 1000 L"
            className="h-12 w-12 shrink-0 rounded-xl border-2 border-slate-200 bg-white text-2xl font-bold text-sky-800 hover:border-sky-600 disabled:opacity-30"
          >
            +
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">De 1000 L à 10 000 L, par tranches de 1000 L.</p>
      </fieldset>

      <LocationPicker initial={home} />

      <div>
        <label className={labelClass} htmlFor="neighborhood">
          Quartier
        </label>
        <input
          id="neighborhood"
          name="neighborhood"
          list="neighborhoods"
          className={inputClass}
          placeholder="Ex. Nzeng-Ayong"
          defaultValue={defaults.neighborhood}
          required
        />
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
          defaultValue={defaults.landmark}
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
          <input
            id="customerName"
            name="customerName"
            className={inputClass}
            autoComplete="name"
            defaultValue={defaults.name}
            required
          />
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
            defaultValue={defaults.phone}
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
