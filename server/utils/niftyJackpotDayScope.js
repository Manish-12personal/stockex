import { startOfISTDayFromKey, endOfISTDayFromKey } from './istDate.js';

/**
 * Mongo filter: bids that belong to an IST calendar day `YYYY-MM-DD`.
 * - Primary: `betDate` equals the key (canonical).
 * - Fallback: `betDate` differs but `createdAt` falls in that IST midnight–midnight window
 *   (fixes legacy rows saved with wrong `betDate` when `getTodayIST()` used UTC).
 *
 * @param {string} yyyyMmDd
 * @returns {Record<string, unknown>}
 */
export function buildNiftyJackpotIstDayQuery(yyyyMmDd) {
  const key = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    return { betDate: key };
  }
  const dayStart = startOfISTDayFromKey(key);
  const dayEnd = endOfISTDayFromKey(key);
  if (!dayStart || !dayEnd) {
    return { betDate: key };
  }
  return {
    $or: [
      { betDate: key },
      {
        betDate: { $ne: key },
        createdAt: { $gte: dayStart, $lt: dayEnd },
      },
    ],
  };
}
