// Numéros gabonais : 9 chiffres commençant par 0 (ex. 077 12 34 56), avec ou sans +241.
// Airtel : 074, 076, 077. Moov : 062, 065, 066.
export function normalizeGabonPhone(input: string): string | null {
  let digits = input.replace(/[^\d+]/g, "");
  if (digits.startsWith("+241")) digits = digits.slice(4);
  else if (digits.startsWith("00241")) digits = digits.slice(5);
  else if (digits.startsWith("241") && digits.length === 11) digits = digits.slice(3);
  if (digits.length === 8 && !digits.startsWith("0")) digits = `0${digits}`;
  return /^0[1-9]\d{7}$/.test(digits) ? digits : null;
}

export function isAirtelNumber(phone: string): boolean {
  return /^07[467]\d{6}$/.test(phone);
}

export function displayPhone(phone: string): string {
  return phone.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})$/, "$1 $2 $3 $4");
}
