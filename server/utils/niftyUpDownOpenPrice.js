import { fetchNifty50HistoricalFromKite } from './kiteNiftyQuote.js';

/**
 * Resolve official NIFTY 50 price at an IST calendar second (Kite 1m candle close).
 * Cache key: `${istDayKey}|r${refSec}`. Order: cache → loadPersisted → Kite → ledger fallback.
 */
export async function resolveNiftyUpDownPriceAtIstRef({
  istDayKey,
  refSecSinceMidnightIST,
  cacheGet,
  loadPersisted,
  fetchKiteRef = fetchNifty50HistoricalFromKite,
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

  p = Number(await fetchKiteRef({ interval: 'minute', daysBack: 3, maxCandles: 1200, istDayKey, refSec }));
  if (Number.isFinite(p) && p > 0) {
    return { price: p, source: 'kite' };
  }

  p = Number(await loadLedgerMinEntry());
  if (Number.isFinite(p) && p > 0) {
    logWarn(`[niftyUpDown] price_at_ref ledger_min fallback refSec=${refSec} day=${istDayKey}`);
    return { price: p, source: 'ledger_min' };
  }

  return { price: null, source: null };
}

/**
 * Pick NIFTY 50 1m candle close for a target IST instant from Kite historical data.
 */
export function pickNifty1mCloseForInstant(targetMs, candles) {
  if (!Number.isFinite(targetMs) || !Array.isArray(candles) || candles.length === 0) {
    return null;
  }
  for (const c of candles) {
    const openMs = Number(c.time) * 1000;
    if (!Number.isFinite(openMs)) continue;
    if (targetMs >= openMs && targetMs < openMs + 60000) {
      const close = Number(c.close);
      if (Number.isFinite(close) && close > 0) return close;
      return null;
    }
  }
  // Fallback: find the candle closest before target
  for (let i = candles.length - 1; i >= 0; i--) {
    const openMs = Number(candles[i].time) * 1000;
    if (openMs <= targetMs) {
      const close = Number(candles[i].close);
      if (Number.isFinite(close) && close > 0) return close;
    }
  }
  return null;
}

/**
 * Fetch NIFTY 50 1m candle close at IST reference second from Kite.
 * Cached ~1h per (day, sec) to limit API use.
 */
const CACHE_MS = 3600000;
const cache = new Map();

export async function fetchNifty501mCloseAtIstRef(istDayKey, secSinceMidnightIST) {
  const { istInstantMs } = await import('./istDate.js');
  const targetMs = istInstantMs(istDayKey, secSinceMidnightIST);
  if (targetMs == null) return null;

  const cacheKey = `${istDayKey}|${secSinceMidnightIST}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.t < CACHE_MS) return hit.price;

  try {
    const startTime = Math.max(0, targetMs - 180000);
    const candles = await fetchNifty50HistoricalFromKite({
      interval: 'minute',
      daysBack: 3,
      maxCandles: 1200,
    });
    const close = pickNifty1mCloseForInstant(targetMs, candles);
    if (close != null) {
      cache.set(cacheKey, { t: now, price: close });
    }
    return close;
  } catch (e) {
    console.warn('[niftyUpDownOpenPrice]', e?.message || e);
    return null;
  }
}
