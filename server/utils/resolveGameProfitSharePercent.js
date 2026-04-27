/**
 * Resolves the admin ledger "Share %" for GAME_PROFIT from meta, amount/base, or description text.
 * Used by GET /my-ledger so the UI is never stuck on "—" when the data is derivable.
 */
export function resolveGameProfitSharePercent(doc) {
  if (!doc || doc.reason !== 'GAME_PROFIT') return null;

  const m = doc.meta && typeof doc.meta === 'object' ? doc.meta : {};
  const amt = Number(doc.amount);
  if (!Number.isFinite(amt) || amt < 0) return null;

  const rawSp = m.sharePercent;
  if (rawSp != null && rawSp !== '' && Number.isFinite(Number(rawSp)) && Number(rawSp) >= 0) {
    return Number(rawSp);
  }

  const base = Number(m.baseAmount);
  if (Number.isFinite(base) && base > 0 && Number.isFinite(amt)) {
    return parseFloat(((amt / base) * 100).toFixed(4));
  }

  const desc = String(doc.description || '');
  const tests = [
    /\((\d+\.?\d*)\s*%\s*of/,
    /(\d+\.?\d*)\s*%\s*of\s*[\u20B9₹]/i,
    /(\d+\.?\d*)\s*%\s*of/i,
  ];
  for (const re of tests) {
    const hit = desc.match(re);
    if (hit && hit[1] != null) {
      const n = parseFloat(String(hit[1]));
      if (Number.isFinite(n) && n >= 0) return n;
    }
  }

  return null;
}

export function displaySharePercentString(p) {
  if (p == null || !Number.isFinite(Number(p))) return null;
  return `${Number(p).toFixed(2)}%`;
}
