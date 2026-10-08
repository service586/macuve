"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";
import type { DivIcon, Map as LeafletMap, Marker } from "leaflet";
import { LIBREVILLE_CENTER, type LatLng } from "@/lib/geo";

type Leaflet = typeof import("leaflet");

function pinIcon(L: Leaflet, emoji: string, color: string): DivIcon {
  return L.divIcon({
    className: "",
    html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,.35);font-size:18px">${emoji}</div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });
}

// Carte OpenStreetMap. Avec onPick, le client place son domicile en touchant la carte
// ou en déplaçant le repère. Changer `focus` recentre la carte sur le domicile.
export function MapView({
  home,
  driver,
  onPick,
  focus = 0,
  className = "h-64",
}: {
  home?: LatLng | null;
  driver?: LatLng | null;
  onPick?: (lat: number, lng: number) => void;
  focus?: number;
  className?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<Leaflet | null>(null);
  const map = useRef<LeafletMap | null>(null);
  const homeMarker = useRef<Marker | null>(null);
  const driverMarker = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    onPickRef.current = onPick;
  });

  useEffect(() => {
    let cancelled = false;
    import("leaflet").then((mod) => {
      // Leaflet est un module CommonJS : selon l'outil de build, il arrive sous `default`.
      const L = (mod as unknown as { default?: Leaflet }).default ?? mod;
      if (cancelled || !container.current) return;
      const m = L.map(container.current).setView(LIBREVILLE_CENTER, 12);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      m.on("click", (e) => onPickRef.current?.(e.latlng.lat, e.latlng.lng));
      leaflet.current = L;
      map.current = m;
      setReady(true);
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      homeMarker.current = null;
      driverMarker.current = null;
    };
  }, []);

  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m) return;

    if (home && !homeMarker.current) {
      homeMarker.current = L.marker(home, { icon: pinIcon(L, "🏠", "#0369a1"), draggable: Boolean(onPickRef.current) })
        .on("dragend", (e) => {
          const p = (e.target as Marker).getLatLng();
          onPickRef.current?.(p.lat, p.lng);
        })
        .addTo(m);
    } else if (home) {
      homeMarker.current?.setLatLng(home);
    } else {
      homeMarker.current?.remove();
      homeMarker.current = null;
    }

    if (driver && !driverMarker.current) {
      driverMarker.current = L.marker(driver, { icon: pinIcon(L, "🚚", "#f59e0b") }).addTo(m);
    } else if (driver) {
      driverMarker.current?.setLatLng(driver);
    } else {
      driverMarker.current?.remove();
      driverMarker.current = null;
    }
  }, [ready, home?.lat, home?.lng, driver?.lat, driver?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cadrage : sur le domicile et le camion s'il y en a un, sinon sur le domicile seul.
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m || !home) return;
    // Sans animation : une animation encore en cours quand la page change fait planter Leaflet.
    if (driver) m.fitBounds(L.latLngBounds([home, driver]), { padding: [40, 40], maxZoom: 16, animate: false });
    else m.setView(home, Math.max(m.getZoom(), 16), { animate: false });
  }, [ready, focus, Boolean(driver)]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={container} className={`z-0 w-full overflow-hidden rounded-xl border border-slate-200 ${className}`} />;
}
