/**
 * IST time-of-day helpers for Nifty Bracket bidding window.
 */

function istHmsNow() {
  const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const parts = t.split(':').map((x) => parseInt(x, 10));
  return {
    h: parts[0] || 0,
    m: parts[1] || 0,
    s: parts[2] || 0,
  };
}

export function parseBracketTimeToSecondsIST(str) {
  const parts = String(str || '09:15').split(':').map((x) => parseInt(String(x).trim(), 10));
  const h = Math.min(23, Math.max(0, Number.isFinite(parts[0]) ? parts[0] : 0));
  const m = Math.min(59, Math.max(0, Number.isFinite(parts[1]) ? parts[1] : 0));
  const s =
    parts.length >= 3 && Number.isFinite(parts[2]) ? Math.min(59, Math.max(0, parts[2])) : 0;
  return h * 3600 + m * 60 + s;
}

/**
 * @param {string} startStr - e.g. 09:15:29
 * @param {string} endStr - e.g. 15:29 (inclusive through 15:29:59) or 15:29:45 for exact end
 */
export function isCurrentTimeWithinBracketBiddingIST(startStr, endStr) {
  const { h, m, s } = istHmsNow();
  const nowSec = h * 3600 + m * 60 + s;
  const startSec = parseBracketTimeToSecondsIST(startStr);
  let endSec = parseBracketTimeToSecondsIST(endStr);
  const endParts = String(endStr || '').trim().split(':');
  if (endParts.length === 2) {
    endSec += 59;
  }
  return nowSec >= startSec && nowSec <= endSec;
}
