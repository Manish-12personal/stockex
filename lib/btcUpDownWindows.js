/**
 * BTC Up/Down — IST schedule (product spec).
 *
 * - Session: first bet 00:00:01, last result at 23:45:00 (configurable via GameSettings).
 * - Each round: 15-minute betting window (e.g. 1:00:00–1:14:59). **Open (baseline)** = Binance 1m close at
 *   **window start** (same second as first bet in the window). **Result (close)** = Binance 1m close at the
 *   next quarter-hour after betting ends (e.g. 1:30:00); settlement = result + 1s.
 * - Window k (0-based activeK): baseline @ betStartSecForK(k), result @ refSecForWindowK(k+1).
 * - Standard IST day (last result 23:45:00): **94** trading windows (#1–#94).
 */

export const BTC_QUARTER_SEC = 15 * 60;

/** With default session end 23:45 IST, k runs 0..93 → 94 windows per day. */
export const BTC_STANDARD_WINDOWS_PER_IST_DAY = 94;

/** Parse "HH:MM" or "HH:MM:SS" to seconds since midnight (no TZ). */
export function parseTimeToSecIST(timeStr) {
  const parts = String(timeStr || '00:00:00').split(':').map(Number);
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}

/** Current clock as seconds since midnight in Asia/Kolkata. */
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

/**
 * Effective IST session bounds from admin config.
 * - start 00:00:00 → treated as 00:00:01 (first betting second).
 * - end 24:00:00 or invalid → 23:45:00 (last scheduled result tick).
 */
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

export function betStartSecForK(k) {
  if (k === 0) return 1;
  return k * BTC_QUARTER_SEC;
}

export function betEndSecForK(k) {
  return (k + 1) * BTC_QUARTER_SEC - 1;
}

export function refSecForWindowK(k) {
  return (k + 1) * BTC_QUARTER_SEC;
}

/**
 * 1-based UI window #W — IST second for **baseline** price (first second of the betting window).
 * Same as betStartSecForK(W − 1) (00:00:01 for window #1).
 */
export function btcOpenRefSecForUiWindow(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return betStartSecForK(0);
  return betStartSecForK(w - 1);
}

/** Alias: baseline clock for UI window #W (window open). */
export function btcWindowBetStartSecForUiWindow(W) {
  return btcOpenRefSecForUiWindow(W);
}

/** Result (close) fix for UI window #W: refSecForWindowK(W). */
export function btcResultRefSecForUiWindow(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return refSecForWindowK(1);
  return refSecForWindowK(w);
}

/**
 * Legacy 0-based index (W−1) for window W — was used for old LTP snapshot keys; kept for tests / migration only.
 */
export function btcOpenSnapKForUiWindow(W) {
  const w = Number(W);
  if (!Number.isFinite(w) || w < 1) return 0;
  return w - 1;
}

export function resultSecForWindowK(k) {
  return (k + 2) * BTC_QUARTER_SEC;
}

/** Last window index k such that result time ≤ lastResultSec. */
export function kMaxForSession(lastResultSec) {
  return Math.floor(lastResultSec / BTC_QUARTER_SEC) - 2;
}

/** Number of bettable windows for the configured session (standard day = 94). */
export function getBtcTradingWindowCount(gameConfig = {}) {
  const { endSec } = getEffectiveBtcSessionBounds(gameConfig);
  const kMax = Math.max(0, kMaxForSession(endSec));
  return kMax + 1;
}

/**
 * Full window state for UI / API.
 * @returns {object} status, canTrade, windowNumber, windowStartSec, windowEndSec, resultTimeSec, settleTimeSec, resultEpoch, countdown, k
 */
export function getBtcUpDownWindowState(nowSec, gameConfig = {}) {
  const { startSec, endSec } = getEffectiveBtcSessionBounds(gameConfig);
  const lastResultSec = endSec;
  const kMax = Math.max(0, kMaxForSession(lastResultSec));

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

  if (nowSec >= endSec) {
    return {
      status: 'post_market',
      canTrade: false,
      windowNumber: 0,
      message: 'BTC Up/Down is closed for today (IST)',
      countdown: 0,
      k: -1,
    };
  }

  let activeK = null;
  for (let kk = 0; kk <= kMax; kk++) {
    const bs = betStartSecForK(kk);
    const be = betEndSecForK(kk);
    if (nowSec >= bs && nowSec <= be) {
      activeK = kk;
      break;
    }
  }

  if (activeK !== null) {
    const windowEndSec = betEndSecForK(activeK);
    // Result = next quarter-hour after betting ends; baseline = window start (already windowStartSec).
    const resultTimeSec = refSecForWindowK(activeK + 1);
    const settleTimeSec = resultTimeSec + 1;
    const secUntilResult = resultTimeSec - nowSec;
    const resultEpoch = Date.now() + secUntilResult * 1000;

    return {
      status: 'open',
      canTrade: true,
      message: 'Trading window open',
      windowNumber: activeK + 1,
      windowStartSec: betStartSecForK(activeK),
      windowEndSec,
      resultTimeSec,
      settleTimeSec,
      resultEpoch,
      countdown: windowEndSec - nowSec,
      k: activeK,
    };
  }

  return {
    status: 'cooldown',
    canTrade: false,
    windowNumber: 0,
    message: 'Betting paused — between windows (IST)',
    countdown: 0,
    k: -1,
  };
}

export function validateBtcUpDownBetPlacement(gameConfig, nowSec, clientWindowNumber) {
  const st = getBtcUpDownWindowState(nowSec, gameConfig);
  if (!st.canTrade) {
    return {
      ok: false,
      message: st.status === 'post_market'
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
