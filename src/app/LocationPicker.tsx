"use client";

import { useRef, useState } from "react";
import { MapView } from "@/components/MapView";
import { isInGrandLibreville, type LatLng } from "@/lib/geo";
import { labelClass, secondaryButtonClass } from "@/components/ui";

export function LocationPicker({ initial }: { initial?: LatLng | null }) {
  const [position, setPosition] = useState<LatLng | null>(initial ?? null);
  const [focus, setFocus] = useState(0);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const attempt = useRef(0);

  function locate() {
    if (!navigator.geolocation) {
      setError("Votre appareil ne permet pas la localisation. Touchez la carte à l'endroit de votre domicile.");
      return;
    }
    setLocating(true);
    setError("");
    setNote("");
    const id = ++attempt.current;
    // Tant que la personne n'a pas répondu à la demande d'autorisation du navigateur, rien ne revient :
    // on ne la laisse pas attendre indéfiniment.
    setTimeout(() => {
      if (attempt.current !== id) return;
      attempt.current++;
      setLocating(false);
      setError(
        "Pas de réponse. Acceptez la demande de localisation du navigateur (en haut de l'écran) et réessayez, ou touchez la carte à l'endroit de votre domicile.",
      );
    }, 30000);
    // D'abord le GPS. S'il ne répond pas (en intérieur, ou sur un ordinateur sans GPS),
    // on se contente de la position approximative donnée par le réseau.
    ask(id, true);
  }

  function ask(id: number, highAccuracy: boolean) {
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (attempt.current !== id) return;
        attempt.current++;
        setLocating(false);
        const found = { lat: p.coords.latitude, lng: p.coords.longitude };
        if (!isInGrandLibreville(found)) {
          setError("Votre appareil vous situe hors du Grand Libreville. Touchez la carte à l'endroit de votre domicile.");
          return;
        }
        setPosition(found);
        setFocus((f) => f + 1);
        if (p.coords.accuracy > 300) {
          setNote(`Position approximative (à ${Math.round(p.coords.accuracy / 100) * 100} m près) : déplacez le repère 🏠 sur votre domicile.`);
        }
      },
      (e) => {
        if (attempt.current !== id) return;
        if (e.code === e.PERMISSION_DENIED) {
          attempt.current++;
          setLocating(false);
          setError(
            "La localisation est bloquée pour ce site. Autorisez-la (icône 🔒 à gauche de l'adresse, puis « Position ») et réessayez, ou touchez la carte à l'endroit de votre domicile.",
          );
        } else if (highAccuracy) {
          ask(id, false);
        } else {
          attempt.current++;
          setLocating(false);
          setError("Impossible de vous localiser. Vérifiez que la localisation de l'appareil est activée, ou touchez la carte à l'endroit de votre domicile.");
        }
      },
      highAccuracy ? { enableHighAccuracy: true, timeout: 10000 } : { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
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
      <MapView
        home={position}
        onPick={(lat, lng) => {
          setPosition({ lat, lng });
          setError("");
          setNote("");
          attempt.current++;
          setLocating(false);
        }} focus={focus}
        className="h-64"
      />
      <input type="hidden" name="lat" value={position?.lat ?? ""} />
      <input type="hidden" name="lng" value={position?.lng ?? ""} />
      <p className={`mt-1 text-sm ${error ? "text-red-700" : note ? "text-amber-700" : position ? "text-emerald-700" : "text-slate-500"}`}>
        {error ||
          note ||
          (position
            ? initial && position === initial
              ? "Adresse de votre dernière commande. Déplacez le repère 🏠 si vous êtes ailleurs."
              : "Position enregistrée. Déplacez le repère 🏠 si besoin."
            : "Touchez « Me localiser » chez vous, ou touchez la carte à l'endroit de votre domicile.")}
      </p>
    </div>
  );
}
