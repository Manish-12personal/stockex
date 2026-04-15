/**
 * Map NIFTY cash LTP (e.g. 23123.65) to the .00–.99 winning index (65).
 * Uses toFixed(2) to avoid float noise.
 */
export function closingPriceToDecimalPart(closingPrice) {
  const x = Number(closingPrice);
  if (!Number.isFinite(x)) return null;
  const s = x.toFixed(2);
  const dot = s.indexOf('.');
  if (dot < 0) return 0;
  const frac = s.slice(dot + 1, dot + 3);
  const n = parseInt(frac, 10);
  if (!Number.isFinite(n) || n < 0 || n > 99) return null;
  return n;
}
