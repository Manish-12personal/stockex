/**
 * Nifty Jackpot — N-user scenarios (no DB).
 * Mirrors declare list-position prize % map; uses real sort + prize ladder utils.
 */
import assert from 'node:assert/strict';
import { sortJackpotBidsByDistanceToReference } from '../utils/niftyJackpotRank.js';
import { resolveJackpotPrizePercentForRank } from '../utils/niftyJackpotPrize.js';

const defaultGameConfig = {
  prizePercentages: [
    { rank: '1st', percent: 45 },
    { rank: '2nd', percent: 10 },
    { rank: '3rd', percent: 3 },
    { rank: '4th', percent: 2 },
    { rank: '5th', percent: 1.5 },
    { rank: '6th', percent: 1 },
    { rank: '7th', percent: 1 },
    { rank: '8th-10th', percent: 0.75 },
    { rank: '11th-20th', percent: 0.5 },
  ],
};

/** Same algorithm as declareNiftyJackpotResult (list position = rank, full ladder %). */
function buildBidPrizeMap(pendingBidsSorted, topWinners, gameConfig) {
  const getPrizePercent = (rank) => resolveJackpotPrizePercentForRank(rank, gameConfig);
  const bidPrizeMap = new Map();
  for (let i = 0; i < pendingBidsSorted.length; i++) {
    const listRank = i + 1;
    const pct = listRank <= topWinners ? getPrizePercent(listRank) : 0;
    const bid = pendingBidsSorted[i];
    bidPrizeMap.set(bid._id.toString(), {
      displayRank: listRank,
      actualRank: listRank,
      grossPrizePercent: pct,
      isTied: false,
      tiedWith: 0,
    });
  }
  return { bidPrizeMap };
}

function mockBid(id, niftyPriceAtBid, createdAtMs, amount = 1000) {
  return {
    _id: { toString: () => String(id) },
    niftyPriceAtBid,
    createdAt: new Date(createdAtMs),
    amount,
  };
}

function runForN(n, refPrice, topWinners = 20) {
  const base = Date.now();
  const bids = [];
  for (let i = 0; i < n; i++) {
    bids.push(
      mockBid(`u${i}`, refPrice + i, base + i * 60_000, 1000 + (i % 7) * 100)
    );
  }
  const sorted = sortJackpotBidsByDistanceToReference(bids, refPrice);
  const { bidPrizeMap } = buildBidPrizeMap(sorted, topWinners, defaultGameConfig);
  const totalPool = bids.reduce((s, b) => s + b.amount, 0);
  return { sorted, bidPrizeMap, totalPool, bids };
}

// --- N users: unique distances → each rank 1..min(N,topWinners) gets ladder % ---
const N_VALUES = [1, 2, 6, 15, 30, 50];
for (const n of N_VALUES) {
  const ref = 22_680;
  const { sorted, bidPrizeMap, totalPool, bids } = runForN(n, ref, 20);

  assert.equal(sorted.length, n, `N=${n}: sort keeps count`);
  for (let i = 1; i < sorted.length; i++) {
    const da = Math.abs(sorted[i - 1].niftyPriceAtBid - ref);
    const db = Math.abs(sorted[i].niftyPriceAtBid - ref);
    assert.ok(
      da <= db + 1e-9,
      `N=${n}: distances non-decreasing after sort (nearest first)`
    );
  }

  const expectedPool = bids.reduce((s, b) => s + b.amount, 0);
  assert.equal(totalPool, expectedPool, `N=${n}: pool = sum of stakes`);

  let allocatedPct = 0;
  let winners = 0;
  for (const b of bids) {
    const info = bidPrizeMap.get(b._id.toString());
    assert.ok(info, `N=${n}: every bid has prize map entry`);
    if (info.grossPrizePercent > 0) {
      winners++;
      allocatedPct += info.grossPrizePercent;
    }
  }

  const expectedWinnerSlots = Math.min(n, 20);
  let sumRanks = 0;
  for (let r = 1; r <= expectedWinnerSlots; r++) {
    sumRanks += resolveJackpotPrizePercentForRank(r, defaultGameConfig);
  }
  assert.ok(
    Math.abs(allocatedPct - sumRanks) < 1e-6,
    `N=${n}: total winner pool % = sum(rank1..min(N,20)) when no ties`
  );
  assert.equal(winners, expectedWinnerSlots, `N=${n}: winner count when topWinners>=N`);
}

// N > topWinners: only first `topWinners` ranks get paid
const nMany = 40;
const topSmall = 10;
const ref2 = 25_000;
const { bidPrizeMap: mapMany, bids: bidsMany } = runForN(nMany, ref2, topSmall);
let paid = 0;
for (const b of bidsMany) {
  if (mapMany.get(b._id.toString()).grossPrizePercent > 0) paid++;
}
assert.equal(paid, topSmall, 'N=40 topWinners=10 → exactly 10 winners');

// Tie: two users same distance → share rank1+2 %
const refTie = 22_680;
const t0 = Date.now();
const tieBids = [
  mockBid('hari', refTie, t0, 18_000),
  mockBid('suresh', refTie, t0 + 600_000, 12_000),
  mockBid('other', refTie + 5, t0 + 1_200_000, 1000),
];
const sortedTie = sortJackpotBidsByDistanceToReference(tieBids, refTie);
const { bidPrizeMap: mapTie } = buildBidPrizeMap(sortedTie, 20, defaultGameConfig);
const p1 = resolveJackpotPrizePercentForRank(1, defaultGameConfig);
const p2 = resolveJackpotPrizePercentForRank(2, defaultGameConfig);
const p3 = resolveJackpotPrizePercentForRank(3, defaultGameConfig);
assert.equal(mapTie.get('hari').grossPrizePercent, p1, 'tie: Hari list rank 1 → full rank1 %');
assert.equal(mapTie.get('suresh').grossPrizePercent, p2, 'tie: Suresh list rank 2 → full rank2 %');
assert.equal(mapTie.get('other').grossPrizePercent, p3, 'tie: next unique distance gets rank 3 %');

// Env N (optional): JACKPOT_TEST_N=100
const envN = Number(process.env.JACKPOT_TEST_N);
if (Number.isFinite(envN) && envN > 0 && envN <= 500) {
  const { bidPrizeMap: mapEnv, bids: bidsEnv } = runForN(envN, 23_000, 20);
  assert.equal(bidsEnv.length, envN);
  const w = bidsEnv.filter((b) => mapEnv.get(b._id.toString()).grossPrizePercent > 0).length;
  assert.equal(w, Math.min(envN, 20));
}

console.log(
  `niftyJackpotNUsers.test.mjs: OK (N in ${N_VALUES.join(',')}, N=40/top10, tie case` +
    (Number.isFinite(envN) && envN > 0 ? `, JACKPOT_TEST_N=${envN}` : '') +
    ')'
);
