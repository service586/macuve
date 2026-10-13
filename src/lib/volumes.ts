// Le client commande par cuves de 1000 L, de 1 à 10 cuves.
export const LITERS_STEP = 1000;
export const MIN_LITERS = 1000;
export const MAX_LITERS = 10000;

export function isValidVolume(liters: number): boolean {
  return Number.isInteger(liters) && liters >= MIN_LITERS && liters <= MAX_LITERS && liters % LITERS_STEP === 0;
}

export function priceForVolume(pricePer1000Xaf: number, liters: number): number {
  return (liters / LITERS_STEP) * pricePer1000Xaf;
}
