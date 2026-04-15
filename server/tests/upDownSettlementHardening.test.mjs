/**
 * Up/Down hardening: authoritative math + Nifty window validation.
 * Run (from server/): npm run test:updown-hardening
 */

import { settleUpDownFromPrices } from '../utils/upDownSettlementMath.js';
import {
  getNiftyUpDownWindowState,
  validateNiftyUpDownBetPlacement,
  getNiftyRoundDurationSec,
} from '../../lib/niftyUpDownWindows.js';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function testSettleAuthoritative() {
  if (settleUpDownFromPrices('UP', 100, 101) !== true) fail('UP win');
  if (settleUpDownFromPrices('DOWN', 100, 99) !== true) fail('DOWN win');
  if (settleUpDownFromPrices('UP', 100, 100) !== false) fail('tie not win');
  if (settleUpDownFromPrices('UP', 0, 100) !== null) fail('invalid open');
  if (settleUpDownFromPrices('UP', 100, 0) !== null) fail('invalid close');
}

function testNiftyDuration() {
  if (getNiftyRoundDurationSec({ roundDuration: 120 }) !== 900) fail('below 900 → 900');
  if (getNiftyRoundDurationSec({ roundDuration: 900 }) !== 900) fail('duration 900');
  if (getNiftyRoundDurationSec({ roundDuration: 1800 }) !== 1800) fail('duration 1800');
  if (getNiftyRoundDurationSec({ roundDuration: 30 }) !== 900) fail('invalid → 900');
  if (getNiftyRoundDurationSec({}) !== 900) fail('default 900');
}

function testNiftyWindowValidation() {
  const gc = {
    startTime: '09:15:00',
    endTime: '15:30:00',
    roundDuration: 900,
  };
  // 9:15:00 IST = 33300 sec; first window index 0, window #1, betting until 9:29:59
  const at91530 = 33300 + 30;
  const st = getNiftyUpDownWindowState(at91530, gc);
  if (!st.canTrade || st.windowNumber !== 1) fail(`expected window 1 open at 9:15:30, got ${JSON.stringify(st)}`);

  const ok = validateNiftyUpDownBetPlacement(gc, at91530, 1);
  if (!ok.ok) fail('place window 1 should pass');

  const bad = validateNiftyUpDownBetPlacement(gc, at91530, 2);
  if (bad.ok) fail('wrong window should fail');
}

function testNiftyLtpAndResultClocks() {
  const gc = {
    startTime: '12:45:15',
    endTime: '15:30:00',
    roundDuration: 900,
  };
  const m = 12 * 3600 + 45 * 60;
  const at1250 = m + 5 * 60;
  const st = getNiftyUpDownWindowState(at1250, gc);
  const wantLtp = m + 900 - 1;
  const wantResult = m + 2 * 900;
  if (st.ltpTimeSec !== wantLtp) fail(`LTP sec want ${wantLtp}, got ${st.ltpTimeSec}`);
  if (st.resultTimeSec !== wantResult) fail(`Result sec want ${wantResult}, got ${st.resultTimeSec}`);
}

function main() {
  testSettleAuthoritative();
  testNiftyDuration();
  testNiftyWindowValidation();
  testNiftyLtpAndResultClocks();
  console.log('upDownSettlementHardening tests OK');
}

main();
