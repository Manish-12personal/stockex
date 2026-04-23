import GameResult from '../models/GameResult.js';
import { getTodayISTString, startOfISTDayFromKey, endOfISTDayFromKey, istInstantMs } from '../utils/istDate.js';
import {
  getEffectiveNiftySessionBounds,
  getNiftyRoundDurationSec,
  niftyOpenFixSecForWindow,
  niftyResultSecForWindow,
} from '../../lib/niftyUpDownWindows.js';
import { resolveNiftyUpDownPriceAtIstRef, fetchNifty501mCloseAtIstRef } from '../utils/niftyUpDownOpenPrice.js';

function istSecondsFromMs(ms = Date.now()) {
  const t = new Date(ms).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const parts = t.split(':').map((x) => parseInt(x, 10));
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

function isIstWeekend(ms = Date.now()) {
  const wd = new Date(ms).toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  return wd === 'Sat' || wd === 'Sun';
}


/**
 * Publish missing Nifty Up/Down GameResult rows for windows whose result time has passed (IST).
 * Now uses result-based logic like BTC Up/Down (no LTP).
 */
export async function publishNiftyUpDownGameResults(settings, nowMs = Date.now()) {
  const gc = settings?.games?.niftyUpDown;
  if (!gc || gc.enabled === false) return;

  if (isIstWeekend(nowMs)) return;

  const today = getTodayISTString(new Date(nowMs));
  const dayStart = startOfISTDayFromKey(today);
  const dayEnd = endOfISTDayFromKey(today);
  if (!dayStart || !dayEnd) return;

  const nowSec = istSecondsFromMs(nowMs);
  const { marketOpenSec, marketCloseSec } = getEffectiveNiftySessionBounds(gc);
  const D = getNiftyRoundDurationSec(gc);

  if (nowSec < marketOpenSec || nowSec >= marketCloseSec) return;

  const fmtT = (s) => {
    const h = Math.floor(s / 3600) % 24;
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // Cache for price resolution (similar to BTC)
  const niftyRefPriceCache = new Map();

  for (let W = 1; W < 500; W++) {
    const resultSec = niftyResultSecForWindow(W, gc);
    if (resultSec > nowSec) break;
    if (resultSec >= marketCloseSec) break;

    const existing = await GameResult.findOne({
      gameId: 'updown',
      windowNumber: W,
      windowDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();
    if (existing) continue;

    // Get open price at window start (using price resolution like BTC)
    const openRefSec = marketOpenSec + (W - 1) * D;
    const openCacheKey = `${today}|r${openRefSec}`;
    const resolvedOpen = await resolveNiftyUpDownPriceAtIstRef({
      istDayKey: today,
      refSecSinceMidnightIST: openRefSec,
      cacheGet: (key) => niftyRefPriceCache.get(key),
      loadPersisted: async () => null,
      fetchKiteRef: async ({ istDayKey, refSec }) => {
        return await fetchNifty501mCloseAtIstRef(istDayKey, refSec);
      },
      loadLedgerMinEntry: async () => null,
    });

    const openPrice = resolvedOpen.price;
    if (!openPrice || !Number.isFinite(openPrice)) {
      console.warn(
        `[niftyUpDown] skip GameResult w=${W} day=${today}: could not resolve open price (window start @ ${fmtT(openRefSec)})`
      );
      continue;
    }

    if (resolvedOpen.source !== 'cache') {
      niftyRefPriceCache.set(openCacheKey, openPrice);
    }

    // Get close price at result time (using price resolution like BTC)
    const closeRefSec = resultSec;
    const closeCacheKey = `${today}|r${closeRefSec}`;
    const resolvedClose = await resolveNiftyUpDownPriceAtIstRef({
      istDayKey: today,
      refSecSinceMidnightIST: closeRefSec,
      cacheGet: (key) => niftyRefPriceCache.get(key),
      loadPersisted: async () => null,
      fetchKiteRef: async ({ istDayKey, refSec }) => {
        return await fetchNifty501mCloseAtIstRef(istDayKey, refSec);
      },
      loadLedgerMinEntry: async () => null,
    });

    const closePx = resolvedClose.price;
    if (!closePx || !Number.isFinite(closePx) || closePx <= 0) {
      console.warn(`[niftyUpDown] skip GameResult w=${W} day=${today}: no close price (resolver failed)`);
      continue;
    }

    if (resolvedClose.source !== 'cache') {
      niftyRefPriceCache.set(closeCacheKey, closePx);
    }

    // Compare with previous window's close price instead of current window's open price (like BTC)
    const prevWindowClosePrice = W > 1 ? await getPreviousWindowClosePrice(W - 1, today, dayStart, dayEnd) : null;
    const comparisonPrice = prevWindowClosePrice || openPrice;
    const priceChange = closePx - comparisonPrice;
    const result = priceChange > 0 ? 'UP' : priceChange < 0 ? 'DOWN' : 'TIE';

    const betStartSec = marketOpenSec + (W - 1) * D;
    const betEndSec = marketOpenSec + W * D - 1;

    try {
      await GameResult.create({
        gameId: 'updown',
        windowNumber: W,
        windowDate: dayStart,
        openPrice,
        closePrice: closePx,
        priceChange,
        priceChangePercent: comparisonPrice > 0 ? (priceChange / comparisonPrice) * 100 : 0,
        result,
        windowStartTime: fmtT(betStartSec),
        windowEndTime: fmtT(betEndSec),
        resultTime: new Date(nowMs),
      });
      console.log(
        `[niftyUpDown] ✅ GameResult w=${W} ${result} comparisonPrice=${comparisonPrice} close=${closePx}@${fmtT(closeRefSec)} (openSrc=${resolvedOpen.source} closeSrc=${resolvedClose.source})`
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
}

/**
 * Helper function to get previous window's close price for Nifty comparison (like BTC)
 */
async function getPreviousWindowClosePrice(windowNumber, today, dayStart, dayEnd) {
  const prevRow = await GameResult.findOne({
    gameId: 'updown',
    windowNumber,
    windowDate: { $gte: dayStart, $lt: dayEnd },
  }).select({ closePrice: 1 }).lean();
  return prevRow?.closePrice || null;
}
