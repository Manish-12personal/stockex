import { fetchBtcUsdt1mCloseAtIstRef } from './binanceBtcKline.js';
import { refSecForWindowK } from '../../lib/btcUpDownWindows.js';

const DEBIT_DESC =
  /Up\/Down.*bet.*\(UP\)|Up\/Down.*bet.*\(DOWN\)/i;

/**
 * Resolve price at a single IST second (Binance 1m candle **close** for that minute) — used as fallback; settlement uses **15m IST window** O/C in `binanceBtcKline.js`.
 * Cache key: `${istDayKey}|r${refSec}`. Order: cache → loadPersisted → Binance → ledger fallback.
 */
export async function resolveBtcUpDownPriceAtIstRef({
  istDayKey,
  refSecSinceMidnightIST,
  cacheGet,
  loadPersisted,
  fetchBinanceRef = fetchBtcUsdt1mCloseAtIstRef,
  loadLedgerMinEntry,
  logWarn = console.warn.bind(console),
}) {
  const refSec = Number(refSecSinceMidnightIST);
  if (!Number.isFinite(refSec) || refSec < 0) {
    return { price: null, source: null };
  }
  const cacheKey = `${istDayKey}|r${refSec}`;
  let p = Number(cacheGet(cacheKey));
  if (Number.isFinite(p) && p > 0) {
    return { price: p, source: 'cache' };
  }

  p = Number(await loadPersisted());
  if (Number.isFinite(p) && p > 0) {
    return { price: p, source: 'db' };
  }

  p = Number(await fetchBinanceRef(istDayKey, refSec));
  if (Number.isFinite(p) && p > 0) {
    return { price: p, source: 'binance' };
  }

  p = Number(await loadLedgerMinEntry());
  if (Number.isFinite(p) && p > 0) {
    logWarn(`[btcUpDown] price_at_ref ledger_min fallback refSec=${refSec} day=${istDayKey}`);
    return { price: p, source: 'ledger_min' };
  }

  return { price: null, source: null };
}

/**
 * Resolve price at quarter-hour refSecForWindowK(rw) (legacy snapshot index `rw`).
 * Cache may use `${istDayKey}|r${refSec}` or legacy `${istDayKey}|${rw}`.
 */
export async function resolveBtcUpDownOpenPrice({
  istDayKey,
  rw,
  cacheGet,
  loadPersisted,
  fetchBinanceRef = fetchBtcUsdt1mCloseAtIstRef,
  loadLedgerMinEntry,
  logWarn = console.warn.bind(console),
}) {
  const k = Number(rw);
  const refSec = refSecForWindowK(k);
  const rKey = `${istDayKey}|r${refSec}`;
  const legacyKey = `${istDayKey}|${k}`;
  return resolveBtcUpDownPriceAtIstRef({
    istDayKey,
    refSecSinceMidnightIST: refSec,
    cacheGet: (key) => {
      const v = cacheGet(key);
      if (v != null && v !== undefined) return v;
      if (key === rKey) return cacheGet(legacyKey);
      return undefined;
    },
    loadPersisted,
    fetchBinanceRef,
    loadLedgerMinEntry,
    logWarn,
  });
}

export { DEBIT_DESC };
