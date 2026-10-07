import { randomInt } from "node:crypto";

// Sans 0/O ni 1/I pour éviter les confusions à la lecture.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newOrderRef(): string {
  let ref = "";
  for (let i = 0; i < 8; i++) ref += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return ref;
}

export function newDeliveryCode(): string {
  return String(randomInt(10000)).padStart(4, "0");
}
