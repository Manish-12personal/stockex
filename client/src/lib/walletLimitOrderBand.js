/** MCX / crypto / forex wallet limit-band rules — keep in sync with `server/services/tradingService.js` walletLimitBandKey */

export function walletLimitBandKeyFromFlags({ isCryptoOnly, isForex, exchange, segment, displaySegment }) {
  if (isForex === true && !isCryptoOnly) return 'forex';
  if (isCryptoOnly === true) return 'crypto';
  const seg = String(displaySegment || segment || '').toUpperCase();
  const ex = String(exchange || '').toUpperCase();
  if (ex === 'MCX' || ['MCX', 'MCXFUT', 'MCXOPT', 'COMMODITY'].includes(seg)) return 'mcx';
  return null;
}

/**
 * @param {Record<string,{enabled?:boolean,low?:number,high?:number}>|null|undefined} bands
 * @param {string|null} key - 'mcx' | 'crypto' | 'forex' | null
 * @param {string} orderType - MARKET | LIMIT | SL | SL-M
 * @param {number} apiPriceNum - limit/trigger in same units as API (USD for spot non-crypto forex, etc.)
 * @returns {string|null} error message or null if ok / not applicable
 */
export function validateWalletLimitBand(bands, key, orderType, apiPriceNum) {
  if (!key) return null;
  const ot = String(orderType || '').toUpperCase();
  if (ot === 'MARKET') return null;
  const isPending = ot === 'LIMIT' || ot === 'SL' || ot === 'SL-M';
  if (!isPending) return null;

  const b = bands?.[key] || {};
  if (!b.enabled) {
    return `${key.toUpperCase()}: Pending/limit orders are off. Enable the switch and set High/Low on My Accounts (wallet card).`;
  }
  const low = Number(b.low);
  const high = Number(b.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return `${key.toUpperCase()}: Set valid High greater than Low on My Accounts.`;
  }
  const p = Number(apiPriceNum);
  if (!Number.isFinite(p)) {
    return 'Enter a valid limit/trigger price.';
  }
  if (p < low || p > high) {
    return `Limit/trigger price must be between ${low} and ${high} (${key.toUpperCase()} wallet band).`;
  }
  return null;
}
