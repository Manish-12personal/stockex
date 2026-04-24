/**
 * 1-based UI window #W → IST seconds (rebuilt: W1 result @ 00:15:00, W2 @ 00:30:00).
 * Run (from server/): node tests/btcUpDownUiWindowRef.test.mjs
 */

import {
  betStartSecForK,
  btcWindowBettingStartSec,
  btcWindowResultSec,
  btcOpenRefSecForUiWindow,
  btcResultRefSecForUiWindow,
  btcOpenSnapKForUiWindow,
  BTC_QUARTER_SEC,
} from '../../lib/btcUpDownWindows.js';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function main() {
  if (btcWindowBettingStartSec(1) !== 1) fail('W=1 bet start 00:00:01');
  if (btcWindowResultSec(1) !== 900) fail('W=1 result 00:15:00');
  if (btcWindowBettingStartSec(2) !== 901) fail('W=2 bet start 00:15:01');
  if (btcWindowResultSec(2) !== 1800) fail('W=2 result 00:30:00');
  if (btcOpenRefSecForUiWindow(1) !== 1) fail('open ref W=1');
  if (btcResultRefSecForUiWindow(1) !== 900) fail('result ref W=1');
  if (btcOpenRefSecForUiWindow(87) !== btcWindowBettingStartSec(87)) fail('align open ref');
  if (btcResultRefSecForUiWindow(87) !== 87 * BTC_QUARTER_SEC) fail('result W=87');
  if (btcOpenSnapKForUiWindow(87) !== 86) fail('openSnapK 87');
  if (betStartSecForK(86) !== btcWindowBettingStartSec(87)) fail('legacy k vs W');
  console.log('btcUpDownUiWindowRef tests OK');
}

main();
