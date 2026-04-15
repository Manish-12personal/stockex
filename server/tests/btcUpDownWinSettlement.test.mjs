/**
 * BTC Up/Down win settlement math (unit checks, no DB/API).
 *
 * Confirms schema defaults in GameSettings for btcUpDown (see server/models/GameSettings.js):
 *   - brokeragePercent default: 5  (fee on profit = grossWin − stake)
 *   - profitUserPercent default: 0 (from embedded gameConfigSchema)
 *   - grossPrizeSubBrokerPercent/Broker/Admin defaults: 0 each (gross hierarchy off → flat brokerage path)
 *   - profitSubBrokerPercent/Broker/Admin defaults: 5 / 1 / 1 (% of T; overridden in scenarios below where needed)
 *
 * Resolve path (BTC): user gets full grossWin; totalBrokerage T is debited from SA pool again;
 * distributeWinBrokerage(..., skipUserRebate: true) → user share of T is 0.
 *
 * Run (from server/): npm run test:btc-updown-win-math
 */

import { computeUpDownWinPayout } from '../utils/upDownSettlementMath.js';

function assertApprox(actual, expected, label, eps = 0.02) {
  const a = Number(actual);
  const e = Number(expected);
  if (!Number.isFinite(a) || !Number.isFinite(e) || Math.abs(a - e) > eps) {
    console.error(`FAIL ${label}: expected ${e}, got ${a}`);
    process.exit(1);
  }
}

/**
 * Mirrors distributeWinBrokerage split when all hierarchy roles exist and no cascade.
 * skipUserRebate true → userAmt = 0.
 */
function splitWinBrokerageT(T, userSharePct, sbPct, brPct, adPct) {
  const Tn = Number(T);
  const userAmt =
    Number.isFinite(userSharePct) && userSharePct > 0
      ? parseFloat(((Tn * userSharePct) / 100).toFixed(2))
      : 0;
  const sbAmt = parseFloat(((Tn * sbPct) / 100).toFixed(2));
  const brAmt = parseFloat(((Tn * brPct) / 100).toFixed(2));
  const adAmt = parseFloat(((Tn * adPct) / 100).toFixed(2));
  let saAmt = parseFloat((Tn - userAmt - sbAmt - brAmt - adAmt).toFixed(2));
  if (saAmt < 0) saAmt = 0;
  return { userAmt, sbAmt, brAmt, adAmt, saAmt };
}

function scenarioManishWin({ stake, winMult, brokeragePercent, sbPct, brPct, adPct, userSharePct = 0 }) {
  const { grossWin, brokerage: T, creditTotal, pnl } = computeUpDownWinPayout(
    stake,
    winMult,
    brokeragePercent
  );
  const split = splitWinBrokerageT(T, userSharePct, sbPct, brPct, adPct);
  const profitBeforeFee = parseFloat((grossWin - stake).toFixed(2));
  const saWalletNet =
    stake - creditTotal - T + split.saAmt;

  return {
    stake,
    grossWin,
    creditTotal,
    pnl,
    profitBeforeFee,
    T,
    ...split,
    saWalletNetOneRound: saWalletNet,
  };
}

function main() {
  console.log('BTC Up/Down win settlement — unit math\n');

  // --- Scenario A: Manish plan (5 tickets × 300, mult 1.66667, brokerage 5% of profit, hierarchy 5/1/1 of T)
  const a = scenarioManishWin({
    stake: 1500,
    winMult: 1.66667,
    brokeragePercent: 5,
    sbPct: 5,
    brPct: 1,
    adPct: 1,
  });

  assertApprox(a.creditTotal, 2500.01, 'A: games wallet gross credit');
  assertApprox(a.T, 50.0, 'A: total brokerage T');
  assertApprox(a.sbAmt, 2.5, 'A: SubBroker share of T');
  assertApprox(a.brAmt, 0.5, 'A: Broker share of T');
  assertApprox(a.adAmt, 0.5, 'A: Admin share of T');
  assertApprox(a.saAmt, 46.5, 'A: SA remainder of T');
  assertApprox(a.userAmt, 0, 'A: user rebate of T (skipUserRebate path)');
  assertApprox(a.saWalletNetOneRound, -1003.51, 'A: SA wallet net (stake in − payout − T + SA share of T)');

  console.log('Scenario A (brokeragePercent=5%, hierarchy 5/1/1 of T):');
  console.log(JSON.stringify(a, null, 2));
  console.log('PASS A\n');

  // --- Scenario B: different brokeragePercent (todo: recompute T and scale splits)
  const b = scenarioManishWin({
    stake: 1500,
    winMult: 1.66667,
    brokeragePercent: 7,
    sbPct: 5,
    brPct: 1,
    adPct: 1,
  });
  assertApprox(b.T, 70.0, 'B: T with brokeragePercent=7%');
  assertApprox(b.sbAmt, 3.5, 'B: SubBroker');
  assertApprox(b.brAmt, 0.7, 'B: Broker');
  assertApprox(b.adAmt, 0.7, 'B: Admin');
  assertApprox(b.saAmt, 65.1, 'B: SA remainder');

  console.log('Scenario B (brokeragePercent=7%, same 5/1/1 of T):');
  console.log(JSON.stringify(b, null, 2));
  console.log('PASS B\n');

  console.log('All checks passed.');
  process.exit(0);
}

main();
