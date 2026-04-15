/**
 * Nifty Jackpot: % of total pool per rank (matches admin `prizePercentages` ladder,
 * or per-rank values in `prizeDistribution` when every entry is 0–100).
 */

export const DEFAULT_NIFTY_JACKPOT_PRIZE_LADDER = [
  { rank: '1st', percent: 45 },
  { rank: '2nd', percent: 10 },
  { rank: '3rd', percent: 3 },
  { rank: '4th', percent: 2 },
  { rank: '5th', percent: 1.5 },
  { rank: '6th', percent: 1 },
  { rank: '7th', percent: 1 },
  { rank: '8th-10th', percent: 0.75, count: 3 },
  { rank: '11th-20th', percent: 0.5, count: 10 },
];

function prizePercentFromLadder(rank, prizePercentages) {
  const p = prizePercentages;
  if (rank === 1) return p[0]?.percent ?? 45;
  if (rank === 2) return p[1]?.percent ?? 10;
  if (rank === 3) return p[2]?.percent ?? 3;
  if (rank === 4) return p[3]?.percent ?? 2;
  if (rank === 5) return p[4]?.percent ?? 1.5;
  if (rank === 6) return p[5]?.percent ?? 1;
  if (rank === 7) return p[6]?.percent ?? 1;
  if (rank >= 8 && rank <= 10) return p[7]?.percent ?? 0.75;
  if (rank >= 11 && rank <= 20) return p[8]?.percent ?? 0.5;
  return 0;
}

function distributionLooksLikePoolPercents(arr) {
  return (
    Array.isArray(arr) &&
    arr.length > 0 &&
    arr.every((x) => typeof x === 'number' && x >= 0 && x <= 100)
  );
}

/**
 * @param {number} rank 1-based
 * @param {object} gameConfig settings.games.niftyJackpot (partial ok)
 */
export function resolveJackpotPrizePercentForRank(rank, gameConfig = {}) {
  const ladder = gameConfig.prizePercentages;
  if (Array.isArray(ladder) && ladder.length > 0) {
    return prizePercentFromLadder(rank, ladder);
  }

  const pd = gameConfig.prizeDistribution;
  if (distributionLooksLikePoolPercents(pd) && rank >= 1 && rank <= pd.length) {
    return pd[rank - 1];
  }

  return prizePercentFromLadder(rank, DEFAULT_NIFTY_JACKPOT_PRIZE_LADDER);
}
