/**
 * BTC Up/Down — IST 15m rounds (rebuilt spec).
 *
 * - Window W (1-based): bet from second (W−1)×900+1 through W×900−1 (e.g. W=1: 00:00:01–00:14:59,
 *   W=2: 00:15:01–00:29:59).
 * - Result for window W (fixed, DB-only) at exactly W×900 IST (e.g. W=1 @ 00:15:00, W=2 @ 00:30:00).
 * - Between W×900 and (W+1)×900: no betting (one-second or short gap; next window opens 901).
 * - last result second = endSec from config (e.g. 23:45:00) ⇒ max W = floor(endSec/900).
 */

export const BTC_QUARTER_SEC = 15 * 60;

/** @deprecated use getBtcMaxWindowForSession from session end */
export const BTC_STANDARD_WINDOWS_PER_IST_DAY = 95;

export function parseTimeToSecIST(timeStr) {
  const parts = String(timeStr || '00:00:00').split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

export function currentTotalSecondsIST(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const second = parseInt(parts.find((p) => p.type === 'second')?.value ?? '0', 10);
  return hour * 3600 + minute * 60 + second;
}

export function getEffectiveBtcSessionBounds(gameConfig = {}) {
  let endSec = parseTimeToSecIST(gameConfig.endTime ?? '23:45:00');
  if (!Number.isFinite(endSec) || endSec <= 0 || endSec > 86400) {
    endSec = 23 * 3600 + 45 * 60;
  }
  if (endSec === 86400) {
    endSec = 23 * 3600 + 45 * 60;
  }
  let startSec = parseTimeToSecIST(gameConfig.startTime ?? '00:00:01');
  if (startSec === 0) startSec = 1;
  if (!Number.isFinite(startSec) || startSec < 0) startSec = 1;
  if (startSec >= endSec) startSec = 1;
  return { startSec, endSec };
}

/** First betting second of window W (1-based). W=1 → 1 (00:00:01). */
export function btcWindowBettingStartSec(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return 1;
  return (w - 1) * BTC_QUARTER_SEC + 1;
}

/** Last second you can bet in window W. W=1 → 899 (00:14:59). */
export function btcWindowBettingEndSec(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return 899;
  return w * BTC_QUARTER_SEC - 1;
}

/** Result prints at W×15min on the clock (W=1 → 00:15:00). */
export function btcWindowResultSec(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return BTC_QUARTER_SEC;
  return w * BTC_QUARTER_SEC;
}

/**
 * @deprecated use btcWindowBettingStartSec
 * k was 0-based "active" index; W = k+1, old bet start was betStartSecForK(k)
 */
export function betStartSecForK(k) {
  const kk = Number(k);
  if (!Number.isFinite(kk) || kk < 0) return 1;
  return btcWindowBettingStartSec(kk + 1);
}

export function betEndSecForK(k) {
  const kk = Number(k);
  if (!Number.isFinite(kk) || kk < 0) return 899;
  return btcWindowBettingEndSec(kk + 1);
}

/** @deprecated — prefer btcWindowResultSec(W) */
export function refSecForWindowK(k) {
  return (Number(k) + 1) * BTC_QUARTER_SEC;
}

/** First second used for 15m OHLC from Binance (window start) — same as betting start. */
export function btcOpenRefSecForUiWindow(W) {
  return btcWindowBettingStartSec(W);
}

export function btcWindowBetStartSecForUiWindow(W) {
  return btcWindowBettingStartSec(W);
}

/** When result is fixed (stuck) for window W. */
export function btcResultRefSecForUiWindow(W) {
  return btcWindowResultSec(W);
}

export function btcOpenSnapKForUiWindow(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return 0;
  return w - 1;
}

export function resultSecForWindowK(k) {
  return (Number(k) + 2) * BTC_QUARTER_SEC;
}

export function kMaxForSession(lastResultSec) {
  return Math.max(0, Math.floor(lastResultSec / BTC_QUARTER_SEC) - 1);
}

export function getBtcMaxWindowForSession(gameConfig = {}) {
  const { endSec } = getEffectiveBtcSessionBounds(gameConfig);
  return Math.max(0, Math.floor(endSec / BTC_QUARTER_SEC));
}

export function getBtcTradingWindowCount(gameConfig = {}) {
  return getBtcMaxWindowForSession(gameConfig);
}

/**
 * isBetting: now is inside [start,end] for some W
 * isGap:     now === W*900 (result second, no bet)
 * pre/post:  outside [startSec, endSec)
 */
export function getBtcUpDownWindowState(nowSec, gameConfig = {}) {
  const { startSec, endSec } = getEffectiveBtcSessionBounds(gameConfig);
  const maxW = getBtcMaxWindowForSession(gameConfig);

  if (nowSec < startSec) {
    return {
      status: 'pre_market',
      canTrade: false,
      windowNumber: 0,
      message: 'BTC Up/Down opens at 00:00:01 IST',
      countdown: startSec - nowSec,
      k: -1,
    };
  }

  if (nowSec > endSec) {
    return {
      status: 'post_market',
      canTrade: false,
      windowNumber: 0,
      message: 'BTC Up/Down is closed for today (IST)',
      countdown: 0,
      k: -1,
    };
  }

  for (let W = 1; W <= maxW; W++) {
    const bs = btcWindowBettingStartSec(W);
    const be = btcWindowBettingEndSec(W);
    if (nowSec >= bs && nowSec <= be) {
      const resultTimeSec = btcWindowResultSec(W);
      const secUntilResult = resultTimeSec - nowSec;
      const resultEpoch = Date.now() + secUntilResult * 1000;
      const settleTimeSec = resultTimeSec + 1;
      return {
        status: 'open',
        canTrade: true,
        message: 'Trading window open',
        windowNumber: W,
        windowStartSec: bs,
        windowEndSec: be,
        resultTimeSec,
        settleTimeSec,
        resultEpoch,
        countdown: be - nowSec,
        k: W - 1,
      };
    }
  }

  for (let W = 1; W <= maxW; W++) {
    const rs = btcWindowResultSec(W);
    if (nowSec === rs) {
      return {
        status: 'cooldown',
        canTrade: false,
        windowNumber: 0,
        message: 'Result at quarter-hour (IST) — no betting this second',
        countdown: 0,
        k: -1,
        resultSecondForWindow: W,
      };
    }
  }

  return {
    status: 'cooldown',
    canTrade: false,
    windowNumber: 0,
    message: 'Between windows (IST)',
    countdown: 0,
    k: -1,
  };
}

export function validateBtcUpDownBetPlacement(gameConfig, nowSec, clientWindowNumber) {
  const st = getBtcUpDownWindowState(nowSec, gameConfig);
  if (!st.canTrade) {
    return {
      ok: false,
      message:
        st.status === 'post_market'
          ? 'BTC Up/Down is outside trading hours (IST).'
          : 'Betting is not open for this window. Refresh and try again.',
    };
  }
  const wn = Number(clientWindowNumber);
  if (!Number.isFinite(wn) || wn !== st.windowNumber) {
    return {
      ok: false,
      message: 'Window mismatch — refresh the game and place your bet again.',
    };
  }
  return { ok: true, state: st };
}
