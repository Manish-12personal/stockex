import NiftyBracketTrade from '../models/NiftyBracketTrade.js';

import NiftyJackpotBid from '../models/NiftyJackpotBid.js';

import { buildNiftyJackpotIstDayQuery } from '../utils/niftyJackpotDayScope.js';

import NiftyJackpotResult from '../models/NiftyJackpotResult.js';

import NiftyNumberBet from '../models/NiftyNumberBet.js';

import GameResult from '../models/GameResult.js';

import GamesWalletLedger from '../models/GamesWalletLedger.js';

import UpDownWindowSettlement from '../models/UpDownWindowSettlement.js';

import GameSettings from '../models/GameSettings.js';

import { resolveBtcUpDownPriceAtIstRef, DEBIT_DESC } from '../utils/btcUpDownOpenPrice.js';

import { resolveNiftyBracketTrade } from './niftyBracketResolve.js';

import { declareNiftyJackpotResult, NiftyJackpotDeclareError } from './niftyJackpotDeclare.js';

import { declareNiftyNumberResultForDate } from './niftyNumberDeclareService.js';

import { settleUpDownUserWindowFromLedger } from './upDownSettlementService.js';

import { getMarketData } from './zerodhaWebSocket.js';

import { getCryptoPrice } from './binanceWebSocket.js';

import { fetchNifty50LastPriceFromKite, fetchNifty50HistoricalFromKite } from '../utils/kiteNiftyQuote.js';

import { getTodayISTString, startOfISTDayFromKey, endOfISTDayFromKey, istInstantMs } from '../utils/istDate.js';

import {

  getBtcUpDownWindowState,

  getEffectiveBtcSessionBounds,

  BTC_QUARTER_SEC,

  betStartSecForK,

  btcResultRefSecForUiWindow,

} from '../../lib/btcUpDownWindows.js';

import {

  getEffectiveNiftySessionBounds,

  getNiftyRoundDurationSec,

  niftyResultSecForWindow,

} from '../../lib/niftyUpDownWindows.js';

import { resolveNiftyJackpotSpotPrice } from '../utils/niftyJackpotRank.js';



/**

 * Helper function to get previous window's close price for BTC comparison

 */

async function getPreviousWindowClosePrice(windowNumber, today, dayStart, dayEnd) {

  const GameResult = (await import('../models/GameResult.js')).default;

  const prevRow = await GameResult.findOne({

    gameId: 'btcupdown',

    windowNumber,

    windowDate: { $gte: dayStart, $lt: dayEnd },

  }).select({ closePrice: 1 }).lean();

  return prevRow?.closePrice || null;

}



/**

 * Helper function to get previous window's close price for Nifty comparison

 */

async function getPreviousNiftyWindowClosePrice(windowNumber, today, dayStart, dayEnd) {

  const prevRow = await GameResult.findOne({

    gameId: 'updown',

    windowNumber,

    windowDate: { $gte: dayStart, $lt: dayEnd },

  }).select({ closePrice: 1 }).lean();

  return prevRow?.closePrice || null;

}



/**

 * Pick NIFTY 50 1m candle close for a target IST instant from Kite historical data.

 */

function pickNifty1mCloseForInstant(targetMs, candles) {

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

 * Resolve official NIFTY 50 price at an IST calendar second (Kite 1m candle close).

 * No LTP - uses only historical candles.

 */

async function resolveNiftyUpDownPriceAtIstRef({

  istDayKey,

  refSecSinceMidnightIST,

  cacheGet,

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



  // Fetch from Kite historical candles

  const targetMs = istInstantMs(istDayKey, refSec);

  if (targetMs == null) return { price: null, source: null };



  try {

    const candles = await fetchNifty50HistoricalFromKite({

      interval: 'minute',

      daysBack: 3,

      maxCandles: 1200,

    });

    const close = pickNifty1mCloseForInstant(targetMs, candles);

    if (Number.isFinite(close) && close > 0) {

      return { price: close, source: 'kite' };

    }

  } catch (e) {

    console.warn('[niftyUpDown] price resolution failed:', e?.message || e);

  }



  return { price: null, source: null };

}



function istSecondsNow() {

  const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });

  const parts = t.split(':').map((x) => parseInt(x, 10));

  const h = parts[0] || 0;

  const m = parts[1] || 0;

  const s = parts[2] || 0;

  return h * 3600 + m * 60 + s;

}



function parseTimeToSecIST(str) {

  const parts = String(str || '15:45').split(':').map(Number);

  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);

}



async function resolveNiftyLtpForSettlement() {

  const kite = await fetchNifty50LastPriceFromKite();

  if (kite != null && Number.isFinite(Number(kite)) && Number(kite) > 0) {

    return Number(kite);

  }

  const md = getMarketData();

  const tick = md['256265'] || md[256265];

  const lp = tick?.ltp ?? tick?.last_price;

  if (lp != null && Number.isFinite(Number(lp)) && Number(lp) > 0) {

    return Number(lp);

  }

  return null;

}



/**

 * After `games.niftyJackpot.resultTime` (IST), create `NiftyJackpotResult` with LTP if none exists yet.

 * Disabled when env `NIFTY_JACKPOT_AUTO_LOCK=false`. Skips when no pending bids (nothing to declare).

 */

async function tryAutoLockNiftyJackpotPrice(settings) {

  if (String(process.env.NIFTY_JACKPOT_AUTO_LOCK || 'true').toLowerCase() === 'false') {

    return;

  }

  const gc = settings?.games?.niftyJackpot;

  if (!gc || gc.enabled === false) return;



  const resultSec = parseTimeToSecIST(gc.resultTime || '15:45');

  if (istSecondsNow() < resultSec) return;



  const today = getTodayISTString();

  const existing = await NiftyJackpotResult.findOne({ resultDate: today }).lean();

  if (existing?.resultDeclared) return;

  if (

    existing &&

    existing.lockedPrice != null &&

    Number.isFinite(Number(existing.lockedPrice)) &&

    Number(existing.lockedPrice) > 0

  ) {

    return;

  }

  if (existing) {

    // Row exists but invalid price — leave for ops; do not overwrite

    return;

  }



  const pending = await NiftyJackpotBid.countDocuments({

    $and: [{ status: 'pending' }, buildNiftyJackpotIstDayQuery(today)],

  });

  if (pending < 1) return;



  let lp = await resolveNiftyLtpForSettlement();

  if (lp == null || !Number.isFinite(lp) || lp <= 0) {

    lp = await resolveNiftyJackpotSpotPrice();

  }

  if (lp == null || !Number.isFinite(lp) || lp <= 0) {

    console.warn('[gamesAutoSettlement] nifty jackpot auto-lock: no Nifty LTP, will retry next tick');

    return;

  }



  try {

    await NiftyJackpotResult.create({

      resultDate: today,

      lockedPrice: Number(lp),

      lockedAt: new Date(),

      lockedBy: null,

    });

    console.log(

      `[gamesAutoSettlement] nifty jackpot auto-locked @ ₹${Number(lp)} for ${today} (IST ≥ ${gc.resultTime || '15:45'})`

    );

  } catch (e) {

    if (e?.code === 11000) return;

    console.warn('[gamesAutoSettlement] nifty jackpot auto-lock:', e?.message || e);

  }

}



let lastBracketRun = 0;

let lastUpDownRun = 0;

let lastJackpotRun = 0;

let lastNumberRun = 0;

let lastBtcSettleRun = 0;

let lastNiftyGameResultRun = 0;

const MIN_MS = 45000;



/** In-memory BTC 1m-ref prices (key `${istDayKey}|r${refSec}`) for the current settlement tick. */

const btcRefPriceCache = new Map();



/** In-memory Nifty 1m-ref prices (key `${istDayKey}|r${refSec}`) for the current settlement tick. */

const niftyRefPriceCache = new Map();



/**

 * BTC Up/Down: create GameResult rows from live price (or Binance 1m at result second) + open resolution.

 * Exported for ops backfill after deploy (call with fresh settings + Date.now()).

 */

export async function autoSettleBtcUpDown(settings, nowMs) {

  const gc = settings?.games?.btcUpDown || {};

  if (gc.enabled === false) return;

  // Get live BTC price immediately - prioritize WebSocket for real-time updates
  const btcData = getCryptoPrice('BTCUSDT') || getCryptoPrice('BTC');
  const liveBtcPrice = Number(btcData?.ltp);
  const hasLive = Number.isFinite(liveBtcPrice) && liveBtcPrice > 0;

  if (!hasLive) {
    console.warn('[btcUpDown] No live BTC from WebSocket — using Binance 1m for close where needed');
  } else {
    console.log(`[btcUpDown] Live BTC price available: ₹${liveBtcPrice}`);
  }



  const { startSec, endSec } = getEffectiveBtcSessionBounds(gc);

  // Same IST clock as lib + bet validation (Intl); avoids mismatch with toLocaleTimeString parsing.

  const nowSec = currentTotalSecondsIST(new Date(nowMs));

  if (nowSec < startSec || nowSec >= endSec) return;



  const st = getBtcUpDownWindowState(nowSec, gc);

  let currentWindowNumber;

  if (st.status === 'open') {

    currentWindowNumber = st.windowNumber;

  } else if (st.status === 'cooldown') {

    const elapsed = Math.max(0, nowSec - startSec);

    currentWindowNumber = Math.max(1, Math.floor(elapsed / BTC_QUARTER_SEC) + 1);

  } else {

    return;

  }



  const today = getTodayISTString();



  // GameResult is due for window = currentWindowNumber − 1 (baseline at window start; close at result quarter-hour).

  const resultDueWindow = currentWindowNumber - 1;

  if (resultDueWindow < 1) return;



  const dayStart = startOfISTDayFromKey(today);

  const dayEnd = endOfISTDayFromKey(today);



  // Fill every window 1..resultDueWindow so longer outages still get GameResult rows.

  const fmtT = (s) => {

    const h = Math.floor(s / 3600) % 24;

    const m = Math.floor((s % 3600) / 60);

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00 IST`;

  };



  for (let rw = 1; rw <= resultDueWindow; rw++) {

    const existing = await GameResult.findOne({

      gameId: 'btcupdown',

      windowNumber: rw,

      windowDate: { $gte: dayStart, $lt: dayEnd },

    }).lean();

    if (existing) continue;



    // UI: result for window #rw is at btcResultRefSecForUiWindow(rw). Do not publish GameResult until that IST instant.

    const resultSec = btcResultRefSecForUiWindow(rw);

    if (nowSec < resultSec) continue;



    const openRefSec = betStartSecForK(rw - 1);

    const openCacheKey = `${today}|r${openRefSec}`;

    const resolvedOpen = await resolveBtcUpDownPriceAtIstRef({

      istDayKey: today,

      refSecSinceMidnightIST: openRefSec,

      cacheGet: (key) => btcRefPriceCache.get(key),

      loadPersisted: async () => null,

      loadLedgerMinEntry: async () => null,

    });



    const openPrice = resolvedOpen.price;

    if (!openPrice || !Number.isFinite(openPrice)) {

      console.warn(

        `[btcUpDown] skip GameResult w=${rw} day=${today}: could not resolve open price (window start @ ${fmtT(openRefSec)})`

      );

      continue;

    }



    if (resolvedOpen.source !== 'cache') {

      btcRefPriceCache.set(openCacheKey, openPrice);

    }



    const closeRefSec = resultSec;

    const closeCacheKey = `${today}|r${closeRefSec}`;

    // ALWAYS use live price if available and result time has passed - prioritize persistence
    let closePx = null;
    let closeSource = null;
    
    // If result time has passed and we have live price, ALWAYS use it
    if (hasLive && nowSec >= closeRefSec) {
      closePx = liveBtcPrice;
      closeSource = 'live_websocket';
      console.log(`[btcUpDown] ✅ Using live price for window ${rw}: ₹${closePx} at ${fmtT(closeRefSec)} (result time passed)`);
    } else {
      // Try to get stored/cached price only if live price not available
      const resolvedClose = await resolveBtcUpDownPriceAtIstRef({
        istDayKey: today,
        refSecSinceMidnightIST: closeRefSec,
        cacheGet: (key) => btcRefPriceCache.get(key),
        loadPersisted: async () => null,
        loadLedgerMinEntry: async () => null,
      });
      
      if (resolvedClose.price && Number.isFinite(resolvedClose.price) && resolvedClose.price > 0) {
        closePx = resolvedClose.price;
        closeSource = resolvedClose.source;
        console.log(`[btcUpDown] Using stored price for window ${rw}: ₹${closePx} (${closeSource})`);
      } else {
        closePx = null;
        closeSource = null;
        console.warn(`[btcUpDown] ❌ No price available for window ${rw} - skipping`);
      }
    }

    if (!closePx || !Number.isFinite(closePx) || closePx <= 0) {
      console.warn(`[btcUpDown] skip GameResult w=${rw} day=${today}: no close price (resolver failed)`);
      continue;
    }



    // ALWAYS cache the close price for future use and persistence
    btcRefPriceCache.set(closeCacheKey, closePx);
    console.log(`[btcUpDown] 💾 Cached price for window ${rw}: ₹${closePx} at ${fmtT(closeRefSec)}`);

    // Compare with previous window's close price instead of current window's open price

    const prevWindowClosePrice = rw > 1 ? await getPreviousWindowClosePrice(rw - 1, today, dayStart, dayEnd) : null;

    const comparisonPrice = prevWindowClosePrice || openPrice;

    const priceChange = closePx - comparisonPrice;

    const result = priceChange > 0 ? 'UP' : priceChange < 0 ? 'DOWN' : 'TIE';

    try {

      const gameResult = await GameResult.create({

        gameId: 'btcupdown',

        windowNumber: rw,

        windowDate: dayStart,

        openPrice,

        closePrice: closePx,

        priceChange,

        priceChangePercent: comparisonPrice > 0 ? (priceChange / comparisonPrice) * 100 : 0,

        result,

        windowStartTime: fmtT(openRefSec),

        windowEndTime: fmtT(closeRefSec),

        resultTime: new Date(nowMs),

        priceSource: closeSource,

        settlementCompleted: true,

        settlementProcessedAt: new Date(nowMs),

        metadata: {

          forcedCreation: closeSource === 'live_websocket_forced',

          resultTimeSec: closeRefSec,

          currentTimeSec: nowSec,

          hasLivePrice: hasLive

        }

      });

      console.log(

        `[btcUpDown] ✅ GameResult w=${rw} ${result} comparisonPrice=${comparisonPrice} close=${closePx}@${fmtT(closeRefSec)} (openSrc=${resolvedOpen.source} closeSrc=${closeSource}) - STORED`

      );

    } catch (e) {

      if (e.code !== 11000) throw e;

    }

  }

}



/**

 * Nifty Up/Down: create GameResult rows from Kite 1m candles (no LTP).

 * Similar to BTC Up/Down but uses Kite historical data instead of Binance.

 */

async function autoSettleNiftyUpDown(settings, nowMs) {

  const gc = settings?.games?.niftyUpDown || {};

  if (gc.enabled === false) return;



  const { marketOpenSec, marketCloseSec } = getEffectiveNiftySessionBounds(gc);

  const D = getNiftyRoundDurationSec(gc);



  const nowSec = istSecondsNow();

  if (nowSec < marketOpenSec || nowSec >= marketCloseSec) return;



  const today = getTodayISTString();

  const dayStart = startOfISTDayFromKey(today);

  const dayEnd = endOfISTDayFromKey(today);



  const fmtT = (s) => {

    const h = Math.floor(s / 3600) % 24;

    const m = Math.floor((s % 3600) / 60);

    const sec = s % 60;

    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;

  };



  // Calculate max window number based on current time - only settle when result time has passed

  const elapsed = nowSec - marketOpenSec;

  // Results are due 2 windows after betting window ends

  const resultDueWindow = Math.max(0, Math.floor((elapsed - D) / D));



  for (let rw = 1; rw <= resultDueWindow; rw++) {

    const existing = await GameResult.findOne({

      gameId: 'updown',

      windowNumber: rw,

      windowDate: { $gte: dayStart, $lt: dayEnd },

    }).lean();

    if (existing) continue;



    const resultSec = niftyResultSecForWindow(rw, gc);

    if (nowSec < resultSec) continue;

    if (resultSec >= marketCloseSec) break;



    const openRefSec = marketOpenSec + (rw - 1) * D;

    const openCacheKey = `${today}|r${openRefSec}`;

    const resolvedOpen = await resolveNiftyUpDownPriceAtIstRef({

      istDayKey: today,

      refSecSinceMidnightIST: openRefSec,

      cacheGet: (key) => niftyRefPriceCache.get(key),

    });



    const openPrice = resolvedOpen.price;

    if (!openPrice || !Number.isFinite(openPrice)) {

      console.warn(

        `[niftyUpDown] skip GameResult w=${rw} day=${today}: could not resolve open price (window start @ ${fmtT(openRefSec)})`

      );

      continue;

    }



    if (resolvedOpen.source !== 'cache') {

      niftyRefPriceCache.set(openCacheKey, openPrice);

    }



    const closeRefSec = resultSec;

    const closeCacheKey = `${today}|r${closeRefSec}`;

    const resolvedClose = await resolveNiftyUpDownPriceAtIstRef({

      istDayKey: today,

      refSecSinceMidnightIST: closeRefSec,

      cacheGet: (key) => niftyRefPriceCache.get(key),

    });



    const closePx = resolvedClose.price;

    if (!closePx || !Number.isFinite(closePx) || closePx <= 0) {

      console.warn(`[niftyUpDown] skip GameResult w=${rw} day=${today}: no close price (resolver failed)`);

      continue;

    }



    if (resolvedClose.source !== 'cache') {

      niftyRefPriceCache.set(closeCacheKey, closePx);

    }



    // Compare with previous window's close price instead of current window's open price (like BTC Up/Down)

    const prevWindowClosePrice = rw > 1 ? await getPreviousNiftyWindowClosePrice(rw - 1, today, dayStart, dayEnd) : null;

    const comparisonPrice = prevWindowClosePrice || openPrice;

    const priceChange = closePx - comparisonPrice;

    const result = priceChange > 0 ? 'UP' : priceChange < 0 ? 'DOWN' : 'TIE';



    const betStartSec = marketOpenSec + (rw - 1) * D;

    const betEndSec = marketOpenSec + rw * D - 1;



    try {

      const gameResult = await GameResult.create({

        gameId: 'updown',

        windowNumber: rw,

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

        `[niftyUpDown] ✅ GameResult w=${rw} ${result} comparisonPrice=${comparisonPrice} close=${closePx}@${fmtT(closeRefSec)} (openSrc=${resolvedOpen.source} closeSrc=${resolvedClose.source})`

      );

    } catch (e) {

      if (e.code !== 11000) throw e;

    }

  }

}



export async function runGamesAutoSettlementTick() {

  if (String(process.env.GAMES_AUTO_SETTLEMENT || '').toLowerCase() === 'false') {

    return;

  }



  const now = Date.now();

  const settings = await GameSettings.getSettings().catch(() => null);



  // ---------- Nifty Bracket: active trades past expiresAt (win/loss settlement; not refund-only) ----------

  if (now - lastBracketRun >= MIN_MS) {

    lastBracketRun = now;

    const price = await resolveNiftyLtpForSettlement();

    if (price != null) {

      const due = await NiftyBracketTrade.find({

        status: 'active',

        expiresAt: { $lte: new Date() },

      })

        .limit(200)

        .lean();



      for (const row of due) {

        try {

          const doc = await NiftyBracketTrade.findById(row._id);

          if (!doc || doc.status !== 'active') continue;

          await resolveNiftyBracketTrade(doc, price, {});

        } catch (e) {

          if (!String(e.message || '').includes('still active')) {

            console.warn('[gamesAutoSettlement] bracket', row._id, e.message);

          }

        }

      }

    }

  }



  // ---------- BTC Up/Down: publish GameResult before consuming it in Up/Down loop (same tick) ----------

  if (now - lastBtcSettleRun >= MIN_MS) {

    lastBtcSettleRun = now;

    try {

      await autoSettleBtcUpDown(settings, now);

    } catch (e) {

      console.warn('[gamesAutoSettlement] btcUpDown settle', e?.message || e);

    }

  }



  // ---------- Nifty Up/Down: publish GameResult (result-based, no LTP) ----------

  if (now - lastNiftyGameResultRun >= MIN_MS) {

    lastNiftyGameResultRun = now;

    try {

      await autoSettleNiftyUpDown(settings, now);

    } catch (e) {

      console.warn('[gamesAutoSettlement] niftyUpDown settle', e?.message || e);

    }

  }



  // ---------- Up/Down: use published GameResult (open/close) for users still unsettled ----------

  if (now - lastUpDownRun >= MIN_MS) {

    lastUpDownRun = now;

    const since = new Date(now - 8 * 86400000);

    const results = await GameResult.find({

      resultTime: { $gte: since },

      gameId: { $in: ['updown', 'btcupdown'] },

    })

      .sort({ windowDate: 1, windowNumber: 1, gameId: 1 })

      .limit(2500)

      .lean();



    for (const r of results) {

      if (!r.gameId || !['updown', 'btcupdown'].includes(r.gameId)) continue;

      const wn = Number(r.windowNumber);

      if (!Number.isFinite(wn)) continue;



      const settlementDay = getTodayISTString(new Date(r.windowDate));

      const dayStart = startOfISTDayFromKey(settlementDay);

      const dayEnd = endOfISTDayFromKey(settlementDay);

      if (!dayStart || !dayEnd) continue;



      // BTC: do not credit wallets until IST has reached result time for this window (same calendar day only).

      // Stops early credits if a GameResult row was created before the fix or by inconsistent clocks.

      if (r.gameId === 'btcupdown') {

        const todayIst = getTodayISTString();

        if (settlementDay === todayIst) {

          const nowIstSec = currentTotalSecondsIST(new Date(now));

          if (nowIstSec < btcResultRefSecForUiWindow(wn)) continue;

        }

      }



      // Nifty Up/Down: same rule as POST /game-bet/resolve — no wallet credit until IST has passed the scheduled result second.

      if (r.gameId === 'updown') {

        const todayIst = getTodayISTString();

        if (settlementDay === todayIst) {

          const ndCfg = settings?.games?.niftyUpDown || {};

          const resultSec = niftyResultSecForWindow(wn, ndCfg);

          const nowIstSec = currentTotalSecondsIST(new Date(now));

          if (Number.isFinite(resultSec) && nowIstSec < resultSec) continue;

        }

      }



      const uids = await GamesWalletLedger.distinct('user', {

        gameId: r.gameId,

        entryType: 'debit',

        $or: [{ 'meta.windowNumber': wn }, { 'meta.windowNumber': String(wn) }],

        description: { $regex: 'Up/Down.*bet.*\\(UP\\)|Up/Down.*bet.*\\(DOWN\\)', $options: 'i' },

        createdAt: { $gte: dayStart, $lt: dayEnd },

      });



      for (const uid of uids) {

        const exists = await UpDownWindowSettlement.findOne({

          user: uid,

          gameId: r.gameId,

          windowNumber: wn,

          settlementDay,

        }).lean();

        if (exists) continue;



        const out = await settleUpDownUserWindowFromLedger(

          uid,

          r.gameId,

          wn,

          r.openPrice,

          r.closePrice,

          settlementDay

        );

        if (out.ok && out.ledgerWins > 0) {

          console.log(

            `[gamesAutoSettlement] updown credited user=${uid} game=${r.gameId} window=${wn} wins=${out.ledgerWins}`

          );

        }

      }

    }

  }



  // ---------- Nifty Jackpot: auto-lock at resultTime IST, then declare when locked ----------

  if (now - lastJackpotRun >= MIN_MS) {

    lastJackpotRun = now;

    const today = getTodayISTString();

    await tryAutoLockNiftyJackpotPrice(settings);



    const jr = await NiftyJackpotResult.findOne({

      resultDate: today,

      resultDeclared: { $ne: true },

      lockedPrice: { $exists: true, $ne: null },

    }).lean();



    if (jr && Number.isFinite(Number(jr.lockedPrice))) {

      try {

        await declareNiftyJackpotResult(today);

        console.log(`[gamesAutoSettlement] nifty jackpot declared for ${today}`);

      } catch (e) {

        if (e instanceof NiftyJackpotDeclareError || e?.name === 'NiftyJackpotDeclareError') {

          if (!String(e.message).includes('No pending')) {

            console.warn('[gamesAutoSettlement] jackpot declare:', e.message);

          }

        } else {

          console.warn('[gamesAutoSettlement] jackpot declare:', e.message);

        }

      }

    }

  }



  // ---------- Nifty Number: after resultTime IST, derive result from Kite LTP ----------

  if (now - lastNumberRun >= 120000) {

    lastNumberRun = now;

    const gc = settings?.games?.niftyNumber;

    if (gc?.enabled) {

      const resultSec = parseTimeToSecIST(gc.resultTime || '15:45');

      if (istSecondsNow() >= resultSec) {

        const today = getTodayISTString();

        const pending = await NiftyNumberBet.countDocuments({ betDate: today, status: 'pending' });

        if (pending > 0) {

          const lp = await resolveNiftyLtpForSettlement();

          if (lp != null) {

            try {

              await declareNiftyNumberResultForDate({ date: today, closingPrice: lp });

              console.log(`[gamesAutoSettlement] nifty number declared for ${today} @ ${lp}`);

            } catch (e) {

              if (!String(e.message).includes('No pending')) {

                console.warn('[gamesAutoSettlement] nifty number:', e.message);

              }

            }

          }

        }

      }

    }

  }



}

