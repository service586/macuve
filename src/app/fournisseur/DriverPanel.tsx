"use client";

import { useEffect, useRef, useState } from "react";
import { reportPosition, setAvailability } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";

// Envoi de la position au plus toutes les 20 secondes, pour ménager la batterie et le forfait.
const SEND_EVERY_MS = 20_000;

export function DriverPanel({ available, tracking }: { available: boolean; tracking: boolean }) {
  const [status, setStatus] = useState<"idle" | "ok" | "denied">("idle");
  const lastSent = useRef(0);

  useEffect(() => {
    if (!tracking || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      async (p) => {
        if (Date.now() - lastSent.current < SEND_EVERY_MS) return;
        lastSent.current = Date.now();
        const result = await reportPosition(p.coords.latitude, p.coords.longitude);
        setStatus(result.ok ? "ok" : "idle");
      },
      // Refus, ou téléphone sans localisation.
      () => setStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [tracking]);

  return (
    <div className={`rounded-2xl border-2 p-4 ${available ? "border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-bold">{available ? "🟢 Disponible" : "⚪ Hors service"}</div>
          <div className="text-sm text-slate-600">
            {available
              ? "Les commandes proches de vous vous sont proposées. Gardez cette page ouverte."
              : "Passez disponible pour recevoir les commandes autour de vous."}
          </div>
        </div>
        <form action={setAvailability}>
          <input type="hidden" name="available" value={available ? "0" : "1"} />
          <SubmitButton
            className={`rounded-lg px-4 py-2.5 font-bold ${
              available ? "border border-slate-300 bg-white text-slate-800" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {available ? "Me mettre hors service" : "Je suis disponible"}
          </SubmitButton>
        </form>
      </div>
      {tracking && status === "denied" && (
        <p className="mt-2 text-sm text-red-700">
          La localisation est bloquée. Autorisez-la pour MaCuve dans votre navigateur, sinon aucune commande ne pourra vous être proposée.
        </p>
      )}
      {tracking && status === "ok" && <p className="mt-2 text-sm text-emerald-800">📍 Position partagée.</p>}
    </div>
  );
}
