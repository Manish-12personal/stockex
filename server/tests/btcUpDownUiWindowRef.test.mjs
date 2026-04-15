/**
 * Maps 1-based UI window #W to IST ref seconds (must match getBtcUpDownWindowState for activeK = W-1).
 * Run (from server/): node tests/btcUpDownUiWindowRef.test.mjs
 */

import {
  refSecForWindowK,
  betStartSecForK,
  btcOpenRefSecForUiWindow,
  btcResultRefSecForUiWindow,
  btcOpenSnapKForUiWindow,
} from '../../lib/btcUpDownWindows.js';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function main() {
  const q = 15 * 60;
  if (btcOpenSnapKForUiWindow(87) !== 86) fail(`openSnapK 87: ${btcOpenSnapKForUiWindow(87)}`);
  if (btcOpenRefSecForUiWindow(87) !== betStartSecForK(86)) fail('baseline W=87 → window start 21:30');
  if (btcResultRefSecForUiWindow(87) !== refSecForWindowK(87)) fail('result ref W=87 → 22:00');
  if (btcOpenRefSecForUiWindow(86) !== betStartSecForK(85)) fail('open W=86');
  if (btcResultRefSecForUiWindow(86) !== refSecForWindowK(86)) fail('result W=86');
  if (btcOpenRefSecForUiWindow(1) !== betStartSecForK(0)) fail('open W=1 → 00:00:01');
  if (btcResultRefSecForUiWindow(1) !== refSecForWindowK(1)) fail('result W=1');
  if (btcOpenSnapKForUiWindow(1) !== 0) fail('snap W=1');
  if (btcOpenSnapKForUiWindow(2) !== 1) fail('snap W=2');
  const activeK = 86;
  const W = activeK + 1;
  if (btcOpenRefSecForUiWindow(W) !== betStartSecForK(activeK)) fail('align activeK baseline = bet start');
  if (btcResultRefSecForUiWindow(W) !== refSecForWindowK(activeK + 1)) fail('align activeK result');
  void q;
  console.log('btcUpDownUiWindowRef tests OK');
}

main();
