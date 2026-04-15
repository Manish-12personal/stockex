import { isNseCashMarketOpenIST } from './nseIST.js';

const DEFAULT_DUMMY = 24050.07;

/**
 * When NSE cash is closed and live quotes are missing, return a test LTP (dev or explicit flag only).
 */
export function getDummyNiftyWhenMarketClosedForTesting() {
  if (isNseCashMarketOpenIST()) return null;
  const allow =
    process.env.NODE_ENV !== 'production' ||
    process.env.USE_DUMMY_NIFTY_FALLBACK === 'true' ||
    process.env.USE_DUMMY_NIFTY_FALLBACK === '1';
  if (!allow) return null;
  const n = Number(process.env.DUMMY_NIFTY_LTP);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_DUMMY;
}
