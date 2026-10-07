"use client";

import { useActionState } from "react";
import { registerSupplier } from "../actions";
import { Alert, inputClass, labelClass } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

export function RegisterForm({ zones }: { zones: { id: string; name: string }[] }) {
  const [state, action] = useActionState(registerSupplier, undefined);
  return (
    <form action={action} className="space-y-4">
      {state?.error && <Alert>{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="name">Votre nom</label>
          <input id="name" name="name" className={inputClass} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="businessName">Nom de l&apos;activité</label>
          <input id="businessName" name="businessName" className={inputClass} placeholder="Ex. Citernes Nzeng" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Téléphone (connexion et SMS)</label>
          <input id="phone" name="phone" type="tel" className={inputClass} placeholder="077 12 34 56" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="airtelNumber">Numéro Airtel Money pour vos paiements</label>
          <input id="airtelNumber" name="airtelNumber" type="tel" className={inputClass} placeholder="077 12 34 56" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="tankCapacityL">Capacité de la citerne (litres)</label>
          <input id="tankCapacityL" name="tankCapacityL" type="number" min={500} step={500} className={inputClass} placeholder="10000" required />
        </div>
        <div>
          <label className={labelClass} htmlFor="waterSource">Origine de l&apos;eau</label>
          <select id="waterSource" name="waterSource" className={inputClass} defaultValue="FORAGE">
            <option value="FORAGE">Forage</option>
            <option value="SEEG">SEEG</option>
            <option value="AUTRE">Autre</option>
          </select>
        </div>
      </div>
      <fieldset>
        <legend className={labelClass}>Communes desservies</legend>
        <div className="flex flex-wrap gap-2">
          {zones.map((z) => (
            <label key={z.id} className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2">
              <input type="checkbox" name="zoneIds" value={z.id} /> {z.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className={labelClass} htmlFor="password">Mot de passe</label>
        <input id="password" name="password" type="password" minLength={6} className={inputClass} required />
      </div>
      <SubmitButton>Envoyer ma demande</SubmitButton>
    </form>
  );
}
