/**
 * Shared Nifty Up/Down — pick official NIFTY 50 15m OHLC from Kite-style candle rows
 * (same bar anchoring as Zerodha 15m chart) for a given window index.
 * Used by server settlement, optional publisher, and client UI lock.
 */

/** Max |candle_epoch - target_bar_open_epoch| (seconds) to accept a match. */
export const NIFTY_UPDOWN_15M_BAR_MATCH_MAX_SEC = 300;

/**
 * IST calendar day + seconds since local IST midnight → Unix seconds (bar open instant).
 * @param {string} ymd - YYYY-MM-DD (Asia/Kolkata calendar day)
 * @param {number} istSecSinceMidnight
 */
export function istSecSinceMidnightToUnixForDay(ymd, istSecSinceMidnight) {
  const total = Number(istSecSinceMidnight);
  if (!Number.isFinite(total) || total < 0) return null;
  if (typeof ymd !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const h = Math.floor(total / 3600) % 24;
  const mi = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Date.parse(
    `${ymd}T${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}:${String(s).padStart(2, '0')}+05:30`
  );
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

/**
 * Bar open (IST seconds since midnight) for Nifty Up/Down window `windowNumber` (1-based).
 */
export function niftyUpDownBarOpenIstSec(marketOpenSec, roundDurationSec, windowNumber) {
  const m = Number(marketOpenSec);
  const D = Math.max(900, Number(roundDurationSec) || 900);
  const W = Number(windowNumber);
  if (!Number.isFinite(m) || !Number.isFinite(W) || W < 1) return null;
  return m + (W - 1) * D;
}

/**
 * From Kite historical rows (15minute), find the candle whose open time is nearest
 * `targetUnixSec` and return open/close/high/low. Matches client UserGames behaviour.
 *
 * @param {Array<{time?: number, open?: number, high?: number, low?: number, close?: number}>} candles
 * @param {number} targetUnixSec
 * @returns {{ open: number, close: number, high: number, low: number, bestDist: number, candleTime: number } | null}
 */
export function pickNifty15mBarNearBarOpenUnix(candles, targetUnixSec) {
  if (!Array.isArray(candles) || candles.length === 0 || !Number.isFinite(targetUnixSec)) {
    return null;
  }
  let best = null;
  let bestDist = Infinity;
  for (const c of candles) {
    let t;
    if (c.time != null && typeof c.time === 'number' && Number.isFinite(c.time)) {
      t = c.time > 1e12 ? Math.floor(c.time / 1000) : Math.floor(c.time);
    } else continue;
    const dist = Math.abs(t - targetUnixSec);
    if (dist < bestDist) {
      bestDist = dist;
      const o = Number(c.open);
      const cl = Number(c.close);
      const hi = Number(c.high);
      const lo = Number(c.low);
      if (Number.isFinite(cl) && cl > 0 && Number.isFinite(o)) {
        best = {
          open: o,
          close: cl,
          high: Number.isFinite(hi) ? hi : o,
          low: Number.isFinite(lo) ? lo : o,
          bestDist,
          candleTime: t,
        };
      }
    }
  }
  if (best != null && bestDist < NIFTY_UPDOWN_15M_BAR_MATCH_MAX_SEC) return best;
  return null;
}

/**
 * Resolve 15m OHLC for window `windowNumber` from pre-fetched candles and IST day key.
 *
 * @param {object} opts
 * @param {string} opts.ymd IST YYYY-MM-DD
 * @param {number} opts.marketOpenSec
 * @param {number} opts.roundDurationSec
 * @param {number} opts.windowNumber 1-based
 * @param {Array} candles Kite-format rows from fetch (15minute)
 */
export function resolveNiftyUpDownWindow15mOhlcFromCandles(opts, candles) {
  const { ymd, marketOpenSec, roundDurationSec, windowNumber } = opts;
  const barOpenSec = niftyUpDownBarOpenIstSec(marketOpenSec, roundDurationSec, windowNumber);
  if (barOpenSec == null) return null;
  const targetUnix = istSecSinceMidnightToUnixForDay(ymd, barOpenSec);
  if (targetUnix == null) return null;
  return pickNifty15mBarNearBarOpenUnix(candles, targetUnix);
}
