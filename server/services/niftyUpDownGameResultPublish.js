import GameResult from '../models/GameResult.js';
import { getTodayISTString, startOfISTDayFromKey, endOfISTDayFromKey } from '../utils/istDate.js';
import {
  getEffectiveNiftySessionBounds,
  getNiftyRoundDurationSec,
  niftyOpenFixSecForWindow,
  niftyResultSecForWindow,
} from '../../lib/niftyUpDownWindows.js';
import { fetchNifty50LastPriceFromKite, fetchNifty50HistoricalFromKite } from '../utils/kiteNiftyQuote.js';
import { getMarketData } from './zerodhaWebSocket.js';

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

function istInstantMs(istDayKey, secSinceMidnight) {
  const dayStart = startOfISTDayFromKey(istDayKey);
  if (!dayStart || !Number.isFinite(secSinceMidnight)) return null;
  return dayStart.getTime() + secSinceMidnight * 1000;
}

function pickMinuteCloseNearTarget(candles, targetMs) {
  if (!Array.isArray(candles) || candles.length === 0 || !Number.isFinite(targetMs)) return null;
  let best = null;
  let bestDist = Infinity;
  for (const c of candles) {
    const openMs = Number(c.time) * 1000;
    if (!Number.isFinite(openMs)) continue;
    const mid = openMs + 30000;
    const dist = Math.abs(mid - targetMs);
    if (dist < bestDist) {
      bestDist = dist;
      best = Number(c.close);
    }
  }
  if (best != null && Number.isFinite(best) && best > 0) return best;
  return null;
}

function niftyLtpFromSocket() {
  const md = getMarketData();
  const tick = md['256265'] || md[256265];
  const lp = tick?.ltp ?? tick?.last_price;
  if (lp == null || !Number.isFinite(Number(lp)) || Number(lp) <= 0) return null;
  return Number(lp);
}

/**
 * Publish missing Nifty Up/Down GameResult rows for windows whose result time has passed (IST).
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

  for (let W = 1; W < 500; W++) {
    const resultSec = niftyResultSecForWindow(W, gc);
    if (resultSec > nowSec) break;
    if (resultSec >= marketCloseSec) break;

    const openCandleTargetSec = W === 1 ? marketOpenSec : niftyOpenFixSecForWindow(W, gc);
    if (openCandleTargetSec >= marketCloseSec) break;

    const existing = await GameResult.findOne({
      gameId: 'updown',
      windowNumber: W,
      windowDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();
    if (existing) continue;

    // Window W>1: open LTP must equal prior window's result close (same Nifty spot @ shared IST second).
    let openPx = null;
    if (W > 1) {
      const prev = await GameResult.findOne({
        gameId: 'updown',
        windowNumber: W - 1,
        windowDate: { $gte: dayStart, $lt: dayEnd },
      })
        .select({ closePrice: 1 })
        .lean();
      const p = Number(prev?.closePrice);
      if (!Number.isFinite(p) || p <= 0) {
        console.warn(
          `[niftyUpDownPublish] skip window ${W} day=${today}: need window ${W - 1} close first (result @ ${fmtT(niftyResultSecForWindow(W - 1, gc))} IST)`
        );
        continue;
      }
      openPx = p;
    }

    const targetOpenMs = istInstantMs(today, openCandleTargetSec);
    const targetCloseMs = istInstantMs(today, resultSec);

    if (openPx == null && targetOpenMs != null) {
      const candles = await fetchNifty50HistoricalFromKite({
        interval: 'minute',
        daysBack: 3,
        maxCandles: 1200,
      });
      openPx = pickMinuteCloseNearTarget(candles, targetOpenMs);
    }
    if (openPx == null) {
      openPx = niftyLtpFromSocket() ?? (await fetchNifty50LastPriceFromKite());
    }

    let closePx = null;
    if (targetCloseMs != null) {
      const candles = await fetchNifty50HistoricalFromKite({
        interval: 'minute',
        daysBack: 3,
        maxCandles: 1200,
      });
      closePx = pickMinuteCloseNearTarget(candles, targetCloseMs);
    }
    if (closePx == null) {
      closePx = niftyLtpFromSocket() ?? (await fetchNifty50LastPriceFromKite());
    }

    if (!Number.isFinite(openPx) || openPx <= 0 || !Number.isFinite(closePx) || closePx <= 0) {
      console.warn(`[niftyUpDownPublish] skip window ${W} day=${today}: missing prices (open=${openPx} close=${closePx})`);
      continue;
    }

    const priceChange = closePx - openPx;
    const result = priceChange > 0 ? 'UP' : priceChange < 0 ? 'DOWN' : 'TIE';

    const betStartSec = marketOpenSec + (W - 1) * D;
    const betEndSec = marketOpenSec + W * D - 1;

    try {
      await GameResult.create({
        gameId: 'updown',
        windowNumber: W,
        windowDate: dayStart,
        openPrice: openPx,
        closePrice: closePx,
        priceChange,
        priceChangePercent: openPx > 0 ? (priceChange / openPx) * 100 : 0,
        result,
        windowStartTime: fmtT(betStartSec),
        windowEndTime: fmtT(betEndSec),
        resultTime: new Date(nowMs),
      });
      console.log(
        `[niftyUpDownPublish] GameResult w=${W} ${result} open=${openPx} close=${closePx} day=${today}`
      );
    } catch (e) {
      if (e.code !== 11000) throw e;
    }

    // If window W+1 was published earlier with a candle-derived open, align its open to this close (identical spot).
    const nextRow = await GameResult.findOne({
      gameId: 'updown',
      windowNumber: W + 1,
      windowDate: { $gte: dayStart, $lt: dayEnd },
    })
      .select({ _id: 1, openPrice: 1, closePrice: 1 })
      .lean();
    if (nextRow && Number.isFinite(Number(nextRow.closePrice)) && Number(nextRow.closePrice) > 0) {
      const nextClose = Number(nextRow.closePrice);
      const prevOpen = Number(nextRow.openPrice);
      if (!Number.isFinite(prevOpen) || Math.abs(prevOpen - closePx) > 0.005) {
        const pc = nextClose - closePx;
        await GameResult.updateOne(
          { _id: nextRow._id },
          {
            $set: {
              openPrice: closePx,
              priceChange: pc,
              priceChangePercent: closePx > 0 ? (pc / closePx) * 100 : 0,
              result: pc > 0 ? 'UP' : pc < 0 ? 'DOWN' : 'TIE',
            },
          }
        );
        console.log(
          `[niftyUpDownPublish] aligned window ${W + 1} openPrice to window ${W} close=${closePx} day=${today}`
        );
      }
    }
  }
}
