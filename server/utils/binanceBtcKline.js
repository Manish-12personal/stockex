import axios from 'axios';
import { startOfISTDayFromKey } from './istDate.js';

const cache = new Map();
const CACHE_MS = 3600000;

/**
 * Absolute UTC ms for IST calendar day + seconds since 00:00 IST.
 */
export function istRefInstantMs(istDayKey, secSinceMidnightIST) {
  const dayStart = startOfISTDayFromKey(istDayKey);
  if (!dayStart || !Number.isFinite(secSinceMidnightIST)) return null;
  return dayStart.getTime() + secSinceMidnightIST * 1000;
}

/**
 * Pick 1m candle close for Binance kline rows (array API shape) covering targetMs.
 * Exported for unit tests.
 */
export function pickBtc1mCloseForInstant(targetMs, klines) {
  if (!Number.isFinite(targetMs) || !Array.isArray(klines) || klines.length === 0) {
    return null;
  }
  for (const row of klines) {
    const openMs = Number(row[0]);
    if (!Number.isFinite(openMs)) continue;
    if (targetMs >= openMs && targetMs < openMs + 60000) {
      const c = parseFloat(row[4]);
      if (Number.isFinite(c) && c > 0) return c;
      return null;
    }
  }
  for (let i = klines.length - 1; i >= 0; i--) {
    const openMs = Number(klines[i][0]);
    if (openMs <= targetMs) {
      const c = parseFloat(klines[i][4]);
      if (Number.isFinite(c) && c > 0) return c;
    }
  }
  return null;
}

/**
 * BTCUSDT 1m candle close at IST reference second (e.g. refSecForWindowK).
 * Cached ~1h per (day, sec) to limit API use.
 */
export async function fetchBtcUsdt1mCloseAtIstRef(istDayKey, secSinceMidnightIST) {
  const targetMs = istRefInstantMs(istDayKey, secSinceMidnightIST);
  if (targetMs == null) return null;

  const cacheKey = `${istDayKey}|${secSinceMidnightIST}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.t < CACHE_MS) return hit.price;

  try {
    const startTime = Math.max(0, targetMs - 180000);
    const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1m', startTime: Math.floor(startTime), limit: 10 },
      timeout: 12000,
    });
    const close = pickBtc1mCloseForInstant(targetMs, data);
    if (close != null) {
      cache.set(cacheKey, { t: now, price: close });
    }
    return close;
  } catch (e) {
    console.warn('[binanceBtcKline]', e?.message || e);
    return null;
  }
}
