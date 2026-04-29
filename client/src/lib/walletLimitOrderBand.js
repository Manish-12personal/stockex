/**
 * Limit/pending orders gated by admin per-segment (`allowLimitPendingOrders` on user's merged segmentPermissions).
 */

/**
 * @param {Record<string, { allowLimitPendingOrders?: boolean }>|null|undefined} segmentPermissions
 * @param {string|null|undefined} orderSegment — `order.segment` / `instrument.displaySegment` (same as API order)
 * @param {string} orderType — MARKET | LIMIT | SL | SL-M
 * @returns {string|null} error message or null if ok / not applicable
 */
export function validateLimitPendingFromSegmentPerms(segmentPermissions, orderSegment, orderType) {
  const ot = String(orderType || '').toUpperCase();
  if (ot === 'MARKET') return null;
  if (ot !== 'LIMIT' && ot !== 'SL' && ot !== 'SL-M') return null;

  const seg = String(orderSegment || '').trim().toUpperCase();
  if (!seg) return null;

  const perm = segmentPermissions?.[seg];
  if (perm && perm.allowLimitPendingOrders === false) {
    return `${seg}: Limit & pending orders are off for this segment (admin Segment Permissions).`;
  }
  return null;
}
