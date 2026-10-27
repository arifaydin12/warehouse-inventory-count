// Barcode helpers (pure).

/** EAN-13 check digit for the first 12 digits. */
export function ean13CheckDigit(first12) {
  if (!/^\d{12}$/.test(first12)) throw new Error('EAN-13 base must be 12 digits');
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code) {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** Builds a full EAN-13 from 12 digits. */
export function makeEan13(first12) {
  return first12 + ean13CheckDigit(first12);
}

/** Scanner input is trimmed; hardware scanners may append control characters. */
export function normalizeCode(raw) {
  // eslint-disable-next-line no-control-regex
  return String(raw ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
}
