export type LatLng = { lat: number; lng: number };

export const LIBREVILLE_CENTER: LatLng = { lat: 0.4162, lng: 9.4673 };

// Rectangle large autour du Grand Libreville (Cap Estérias, Ntoum, Owendo).
const BOUNDS = { minLat: 0.2, maxLat: 0.75, minLng: 9.2, maxLng: 9.95 };

export function isInGrandLibreville({ lat, lng }: LatLng): boolean {
  return lat >= BOUNDS.minLat && lat <= BOUNDS.maxLat && lng >= BOUNDS.minLng && lng <= BOUNDS.maxLng;
}

// Distance à vol d'oiseau, en mètres.
export function distanceMeters(a: LatLng, b: LatLng): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6371000 * Math.asin(Math.sqrt(h)));
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters / 50) * 50} m`;
  return `${(meters / 1000).toFixed(1).replace(".", ",")} km`;
}

export function directionsUrl({ lat, lng }: LatLng): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
