"use client";

import { useState } from "react";
import { MapView } from "@/components/MapView";
import type { LatLng } from "@/lib/geo";
import { labelClass, secondaryButtonClass } from "@/components/ui";

export function LocationPicker() {
  const [position, setPosition] = useState<LatLng | null>(null);
  const [focus, setFocus] = useState(0);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");

  function locate() {
    if (!navigator.geolocation) {
      setError("Votre téléphone ne permet pas la localisation. Touchez la carte à l'endroit de votre domicile.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
        setFocus((f) => f + 1);
        setLocating(false);
      },
      () => {
        setError("Localisation refusée ou impossible. Touchez la carte à l'endroit de votre domicile.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className={labelClass}>Votre domicile sur la carte</span>
        <button type="button" onClick={locate} className={`${secondaryButtonClass} !px-3 !py-1.5 text-sm`} disabled={locating}>
          {locating ? "Localisation…" : "📍 Me localiser"}
        </button>
      </div>
      <MapView home={position} onPick={(lat, lng) => setPosition({ lat, lng })} focus={focus} className="h-64" />
      <input type="hidden" name="lat" value={position?.lat ?? ""} />
      <input type="hidden" name="lng" value={position?.lng ?? ""} />
      <p className={`mt-1 text-sm ${error ? "text-red-700" : position ? "text-emerald-700" : "text-slate-500"}`}>
        {error ||
          (position
            ? "Position enregistrée. Déplacez le repère 🏠 si besoin."
            : "Touchez « Me localiser » chez vous, ou touchez la carte à l'endroit de votre domicile.")}
      </p>
    </div>
  );
}
