import axios from 'axios';
import { startOfISTDayFromKey } from './istDate.js';
import {
  coinGeckoConfigured,
  fetchBtcSimpleUsd,
  fetchBtcUsdPricesInRangeMs,
  pickUsdPriceNearestMs,
  openCloseFromUsdPricesApprox,
} from '../services/coingeckoService.js';

const cache = new Map();
const CACHE_MS = 3600000;

let binance429LogAt = 0;
function warnBinanceBtcKline(scope, err) {
  const msg = err?.message || String(err);
  if (/status code 429|\b429\b/i.test(msg)) {
    const t = Date.now();
    if (t - binance429LogAt > 120_000) {
      binance429LogAt = t;
      console.warn(`[binanceBtcKline] ${scope} rate limited (429)`);
    }
    return;
  }
  console.warn(`[binanceBtcKline] ${scope}`, msg);
}

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
    if (coinGeckoConfigured()) {
      const pts = await fetchBtcUsdPricesInRangeMs(targetMs - 360000, targetMs + 360000);
      const close = pickUsdPriceNearestMs(targetMs, pts);
      if (close != null && Number.isFinite(close)) {
        cache.set(cacheKey, { t: now, price: close });
      }
      return close;
    }

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
    warnBinanceBtcKline('1m IST ref', e);
    return null;
  }
}

/**
 * Zerodha-style 15m bar for a BTC Up/Down round: [openRefSec, resultRefSec) in IST, built from
 * consecutive Binance 1m klines. Open = O of the first 1m overlapping the window; close = C of the
 * last 1m that ends at resultRefSec (LTP at end of the 15m, same as 15m chart “C” at that time).
 * @returns {{ open: number, close: number, openSource: string } | null}
 */
export async function fetchBtcFifteenMinuteIstWindowOhlc(istDayKey, openRefSec, resultRefSec) {
  const t0 = istRefInstantMs(istDayKey, openRefSec);
  const t1 = istRefInstantMs(istDayKey, resultRefSec);
  if (t0 == null || t1 == null || t1 <= t0) return null;

  const cacheKey = `15m_ist|${istDayKey}|o${openRefSec}|r${resultRefSec}`;
  const now = Date.now();
  const hit = cache.get(cacheKey);
  if (hit && now - hit.t < CACHE_MS) return hit.ohlc;

  try {
    if (coinGeckoConfigured()) {
      const pts = await fetchBtcUsdPricesInRangeMs(t0 - 120_000, t1 + 120_000);
      const oc = openCloseFromUsdPricesApprox(pts, t0, t1);
      if (oc != null) {
        const ohlc = {
          open: oc.open,
          close: oc.close,
          openSource: 'coingecko_market_chart_range',
        };
        cache.set(cacheKey, { t: now, ohlc });
        return ohlc;
      }
      return null;
    }

    const startTime = Math.floor(t0) - 120_000;
    const endTime = Math.floor(t1) + 120_000;
    const { data } = await axios.get('https://api.binance.com/api/v3/klines', {
      params: { symbol: 'BTCUSDT', interval: '1m', startTime, endTime, limit: 32 },
      timeout: 12000,
    });
    if (!Array.isArray(data) || data.length === 0) return null;

    const rows = data
      .map((row) => {
        const openMs = Number(row[0]);
        const o = parseFloat(row[1]);
        const c = parseFloat(row[4]);
        return { openMs, o, c, row };
      })
      .filter((x) => Number.isFinite(x.openMs) && Number.isFinite(x.o) && x.o > 0 && Number.isFinite(x.c) && x.c > 0);

    if (rows.length === 0) return null;

    // 1m bar [O, O+60s) overlaps [t0, t1) (IST round in absolute ms) ↔ Zerodha-style 15m built from 1m legs
    const inRange = rows.filter(
      (x) => x.openMs < t1 && x.openMs + 60000 > t0
    );
    if (inRange.length === 0) return null;
    inRange.sort((a, b) => a.openMs - b.openMs);
    const first2 = inRange[0];
    const last2 = inRange[inRange.length - 1];

    const ohlc = { open: first2.o, close: last2.c, openSource: 'binance_1m_15m_window' };
    cache.set(cacheKey, { t: now, ohlc });
    return ohlc;
  } catch (e) {
    warnBinanceBtcKline('15m ist window', e);
  }
  return null;
}

const spotRestCache = { t: 0, price: null };
const SPOT_REST_CACHE_MS = 2500;

/**
 * Public REST last price — works when Node has no Binance WebSocket (settlement uses this on the server).
 * Pair with time-guard in autoSettle (only just after result) so we never backfill old windows with "now".
 */
export async function fetchBtcUsdtSpotRest() {
  const now = Date.now();
  if (
    spotRestCache.price != null &&
    Number.isFinite(spotRestCache.price) &&
    now - spotRestCache.t < SPOT_REST_CACHE_MS
  ) {
    return spotRestCache.price;
  }
  try {
    if (coinGeckoConfigured()) {
      const p = await fetchBtcSimpleUsd();
      if (Number.isFinite(p) && p > 0) {
        spotRestCache.t = now;
        spotRestCache.price = p;
        return p;
      }
      return null;
    }

    const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price', {
      params: { symbol: 'BTCUSDT' },
      timeout: 10000,
    });
    const p = parseFloat(data?.price);
    if (Number.isFinite(p) && p > 0) {
      spotRestCache.t = now;
      spotRestCache.price = p;
      return p;
    }
  } catch (e) {
    warnBinanceBtcKline('spot rest', e);
  }
  return null;
}
