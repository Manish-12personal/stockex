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
  const [y, m, d] = istDayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const sec = Number(secSinceMidnight);
  if (!Number.isFinite(sec) || sec < 0) return null;
  return date.getTime() + sec * 1000 - 19800000;
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

export async function publishNiftyUpDownGameResults(settings, nowMs = Date.now()) {
  const gc = settings?.games?.niftyUpDown;
  if (!gc || gc.enabled === false) return;

  if (isIstWeekend(nowMs)) return;

  const today = getTodayISTString(new Date(nowMs));
  const dayStart = startOfISTDayFromKey(today);
  const dayEnd = endOfISTDayFromKey(today);
  const { marketOpenSec, marketCloseSec } = getEffectiveNiftySessionBounds(gc);
  const D = getNiftyRoundDurationSec(gc);
  const nowSec = istSecondsFromMs(nowMs);
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

    const existing = await GameResult.findOne({
      gameId: 'updown',
      windowNumber: W,
      windowDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();
    if (existing) continue;

    const betStartSec = marketOpenSec + (W - 1) * D;
    const betEndSec = marketOpenSec + W * D - 1;

    let openPx = null;
    if (W > 1) {
      const prev = await GameResult.findOne({
        gameId: 'updown',
        windowNumber: W - 1,
        windowDate: { $gte: dayStart, $lt: dayEnd },
      }).select({ closePrice: 1 }).lean();
      openPx = Number(prev?.closePrice);
      if (openPx == null || !Number.isFinite(openPx) || openPx <= 0) {
        const openCandleTargetSec = niftyOpenFixSecForWindow(W, gc);
        const targetOpenMs = istInstantMs(today, openCandleTargetSec);
        if (targetOpenMs != null) {
          const candles = await fetchNifty50HistoricalFromKite({
            interval: 'minute',
            daysBack: 3,
            maxCandles: 1200,
          });
          openPx = pickMinuteCloseNearTarget(candles, targetOpenMs);
        }
      }
    } else {
      const openCandleTargetSec = niftyOpenFixSecForWindow(W, gc);
      const targetOpenMs = istInstantMs(today, openCandleTargetSec);
      if (targetOpenMs != null) {
        const candles = await fetchNifty50HistoricalFromKite({
          interval: 'minute',
          daysBack: 3,
          maxCandles: 1200,
        });
        openPx = pickMinuteCloseNearTarget(candles, targetOpenMs);
      }
    }
    if (openPx == null) {
      openPx = niftyLtpFromSocket() ?? (await fetchNifty50LastPriceFromKite());
    }

    const targetCloseMs = istInstantMs(today, resultSec);

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

    const nextRow = await GameResult.findOne({
      gameId: 'updown',
      windowNumber: W + 1,
      windowDate: { $gte: dayStart, $lt: dayEnd },
    }).lean();
    if (nextRow && nextRow.openPrice != null && Math.abs(Number(nextRow.openPrice) - closePx) > 0.01) {
      await GameResult.updateOne(
        { _id: nextRow._id },
        {
          $set: {
            openPrice: closePx,
            priceChange: Number(nextRow.closePrice) - closePx,
            priceChangePercent: closePx > 0 ? ((Number(nextRow.closePrice) - closePx) / closePx) * 100 : 0,
            result:
              Number(nextRow.closePrice) > closePx
                ? 'UP'
                : Number(nextRow.closePrice) < closePx
                ? 'DOWN'
                : 'TIE',
          },
        }
      );
      console.log(
        `[niftyUpDownPublish] aligned window ${W + 1} openPrice to window ${W} close=${closePx} day=${today}`
      );
    }
  }
}
