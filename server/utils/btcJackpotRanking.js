/**
 * BTC Jackpot ranking + tie handling utilities.
 *
 * Rules (from user spec):
 *   - Rank = nearest predicted BTC to the reference (live spot for leaderboard,
 *     locked 23:30 close for declaration), then earliest `createdAt` as tie-break
 *     on distance equality when we want a single ordered list.
 *   - Top 20 ranks win % of the Bank per `prizePercentages` (point 8).
 *   - EXACT distance ties (two or more winners clashing, point 9): combine the
 *     sum of their rank %s and split it equally among the tied bids.
 */

export function absDist(predicted, reference) {
  const p = Number(predicted);
  const r = Number(reference);
  if (!Number.isFinite(p) || !Number.isFinite(r)) return Infinity;
  return Math.abs(p - r);
}

function bidCreatedAtMs(bid) {
  if (!bid) return 0;
  if (bid.createdAt) {
    const t = +new Date(bid.createdAt);
    return Number.isFinite(t) ? t : 0;
  }
  if (bid._id?.getTimestamp) {
    const t = +bid._id.getTimestamp();
    return Number.isFinite(t) ? t : 0;
  }
  return 0;
}

/**
 * Returns a new array sorted by ascending distance, then ascending createdAt.
 * Does not mutate the input.
 */
export function rankBtcJackpotBids(bids, refPrice) {
  const list = Array.isArray(bids) ? [...bids] : [];
  return list.sort((a, b) => {
    const da = absDist(a.predictedBtc, refPrice);
    const db = absDist(b.predictedBtc, refPrice);
    if (da !== db) return da - db;
    return bidCreatedAtMs(a) - bidCreatedAtMs(b);
  });
}

/** % of Bank for the given 1-based rank, or 0 if outside ladder. */
export function percentOfRankFromConfig(rank, prizePercentages) {
  if (!Array.isArray(prizePercentages) || !Number.isFinite(Number(rank))) return 0;
  const r = Number(rank);
  const row = prizePercentages.find((p) => Number(p?.rank) === r);
  if (!row) return 0;
  const pct = Number(row.percent);
  return Number.isFinite(pct) && pct > 0 ? pct : 0;
}

/** Fixed-precision distance key for exact-tie grouping. 4dp is safe for BTC spot. */
export function distanceTieKey(bid, refPrice) {
  const d = absDist(bid.predictedBtc, refPrice);
  if (!Number.isFinite(d) || d === Infinity) return 'inf';
  return d.toFixed(4);
}

/**
 * Group a sorted bid list into tie groups by identical distance to `refPrice`.
 * Each group gets the combined % of all the ranks it occupies, split equally.
 *
 * @param {Array} sorted            Output of rankBtcJackpotBids().
 * @param {number} refPrice         Reference BTC (locked 23:30 close at declare, live spot for UI).
 * @param {(rank:number)=>number} prizePercentOfRank  Resolver — usually
 *                                  r => percentOfRankFromConfig(r, gc.prizePercentages).
 * @returns {Array<{ startRank:number, bids:Array, perBidPct:number, combinedPct:number, tied:boolean }>}
 */
export function buildTieGroupedRanks(sorted, refPrice, prizePercentOfRank) {
  const groups = [];
  if (!Array.isArray(sorted) || sorted.length === 0) return groups;

  let i = 0;
  while (i < sorted.length) {
    const key = distanceTieKey(sorted[i], refPrice);
    let j = i + 1;
    while (j < sorted.length && distanceTieKey(sorted[j], refPrice) === key) j++;
    const groupBids = sorted.slice(i, j);

    let combinedPct = 0;
    for (let rank = i + 1; rank <= j; rank++) {
      combinedPct += Number(prizePercentOfRank(rank)) || 0;
    }
    const perBidPct = groupBids.length > 0 ? combinedPct / groupBids.length : 0;

    groups.push({
      startRank: i + 1,
      bids: groupBids,
      perBidPct,
      combinedPct,
      tied: groupBids.length > 1,
    });

    i = j;
  }
  return groups;
}
