/**
 * Allow Nifty Jackpot bids outside configured bidding hours (local testing only).
 * Production: set NIFTY_JACKPOT_ALLOW_TEST_BIDDING=true to enable.
 */
export function isNiftyJackpotBiddingHoursBypassedForTesting() {
  if (process.env.NODE_ENV !== 'production') return true;
  const v = process.env.NIFTY_JACKPOT_ALLOW_TEST_BIDDING;
  return v === 'true' || v === '1';
}

/** Nifty Bracket: allow trades outside bidding window (production: NIFTY_BRACKET_ALLOW_TEST_BIDDING=true). */
export function isNiftyBracketBiddingHoursBypassedForTesting() {
  if (process.env.NODE_ENV !== 'production') return true;
  const v = process.env.NIFTY_BRACKET_ALLOW_TEST_BIDDING;
  return v === 'true' || v === '1';
}
