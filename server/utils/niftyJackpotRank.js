import { getMarketData } from '../services/zerodhaWebSocket.js';
import { fetchNifty50LastPriceFromKite } from './kiteNiftyQuote.js';
import { getDummyNiftyWhenMarketClosedForTesting } from './dummyNiftyLtp.js';

export function getBidTimeMs(bid) {
  if (bid.createdAt) return new Date(bid.createdAt).getTime();
  if (bid._id?.getTimestamp?.()) return bid._id.getTimestamp().getTime();
  return 0;
}

/**
 * Distance from bid's locked NIFTY level to a reference (live spot or closing price).
 * Missing bid price sorts last.
 */
export function jackpotDistanceToReference(bid, refPrice) {
  const ref = Number(refPrice);
  if (!Number.isFinite(ref) || ref <= 0) return Number.POSITIVE_INFINITY;
  const p = bid.niftyPriceAtBid;
  if (p == null || !Number.isFinite(Number(p))) return Number.POSITIVE_INFINITY;
  return Math.abs(Number(p) - ref);
}

/** Group key for ties: same distance to reference (4 dp) share merged rank prizes */
export function jackpotDistanceTieKey(bid, refPrice) {
  const d = jackpotDistanceToReference(bid, refPrice);
  if (!Number.isFinite(d) || d === Number.POSITIVE_INFINITY) return 'inf';
  return d.toFixed(4);
}

/**
 * Nearest to reference first, then earlier bid time.
 * If reference is invalid, falls back to legacy sort (higher NIFTY at bid).
 */
export function sortJackpotBidsByDistanceToReference(bids, refPrice) {
  const ref = Number(refPrice);
  const refOk = Number.isFinite(ref) && ref > 0;
  if (!refOk) {
    return sortJackpotBidsForRanking(bids);
  }
  return [...bids].sort((a, b) => {
    const da = jackpotDistanceToReference(a, ref);
    const db = jackpotDistanceToReference(b, ref);
    if (da !== db) return da - db;
    return getBidTimeMs(a) - getBidTimeMs(b);
  });
}

/**
 * Legacy: rank by NIFTY level at bid (higher first), then earlier time.
 * Kept for callers that have no reference price.
 */
export function sortJackpotBidsForRanking(bids) {
  return [...bids].sort((a, b) => {
    const pa =
      a.niftyPriceAtBid != null && Number.isFinite(Number(a.niftyPriceAtBid))
        ? Number(a.niftyPriceAtBid)
        : Number.NEGATIVE_INFINITY;
    const pb =
      b.niftyPriceAtBid != null && Number.isFinite(Number(b.niftyPriceAtBid))
        ? Number(b.niftyPriceAtBid)
        : Number.NEGATIVE_INFINITY;
    if (pb !== pa) return pb - pa;
    return getBidTimeMs(a) - getBidTimeMs(b);
  });
}

export function niftyAtBidTieKey(bid) {
  if (bid.niftyPriceAtBid == null || !Number.isFinite(Number(bid.niftyPriceAtBid))) return 'null';
  return Number(bid.niftyPriceAtBid).toFixed(2);
}

/** Live NIFTY 50 spot for leaderboard / UI (WS → Kite → dummy in dev) */
export async function resolveNiftyJackpotSpotPrice() {
  const md = getMarketData();
  const niftyWs = md['256265'] || md['99926000'];
  let spot =
    niftyWs?.ltp != null && Number.isFinite(Number(niftyWs.ltp)) ? Number(niftyWs.ltp) : null;
  if (spot == null) {
    spot = await fetchNifty50LastPriceFromKite();
  }
  if (spot == null) {
    spot = getDummyNiftyWhenMarketClosedForTesting();
  }
  return spot;
}
