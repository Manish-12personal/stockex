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
 * @returns {string|null} error message or null if ok / not applicable
 */
export function validateWalletLimitBand(bands, key, orderType) {
  if (!key) return null;
  const ot = String(orderType || '').toUpperCase();
  if (ot === 'MARKET') return null;
  const isPending = ot === 'LIMIT' || ot === 'SL' || ot === 'SL-M';
  if (!isPending) return null;

  const b = bands?.[key] || {};
  if (!b.enabled) {
    return `${key.toUpperCase()}: Pending/limit orders are off. Turn ON the checkbox on My Accounts → ${key.toUpperCase()} wallet card.`;
  }
  return null;
}
