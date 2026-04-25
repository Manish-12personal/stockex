import { startOfISTDayFromKey, endOfISTDayFromKey } from './istDate.js';

/**
 * Mongo filter for BTC Jackpot bids belonging to an IST calendar day (YYYY-MM-DD).
 * Primary match: exact betDate. Fallback: createdAt within the IST midnight-midnight window
 * (covers any legacy row whose betDate was computed with a wrong timezone).
 *
 * @param {string} yyyyMmDd
 * @returns {Record<string, unknown>}
 */
export function btcJackpotDayFilter(yyyyMmDd) {
  const key = String(yyyyMmDd || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return { betDate: key };
  const dayStart = startOfISTDayFromKey(key);
  const dayEnd = endOfISTDayFromKey(key);
  if (!dayStart || !dayEnd) return { betDate: key };
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
