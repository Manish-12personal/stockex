/**
 * BTC Up/Down open price resolution (cache → DB → Binance → ledger) + 1m kline picker.
 * Run (from server/): npm run test:btc-updown-open-price
 */

import { pickBtc1mCloseForInstant, istRefInstantMs } from '../utils/binanceBtcKline.js';
import { refSecForWindowK } from '../../lib/btcUpDownWindows.js';
import { resolveBtcUpDownOpenPrice } from '../utils/btcUpDownOpenPrice.js';

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

function testPickWithinMinute() {
  const openMs = 1_700_000_000_000;
  const targetMs = openMs + 45_000;
  const klines = [[openMs, 1, 2, 3, 333.5, 0]];
  const c = pickBtc1mCloseForInstant(targetMs, klines);
  if (c !== 333.5) fail(`pick within minute: got ${c}`);
}

function testPickFallbackLastBeforeTarget() {
  const openMs = 1_700_000_000_000;
  const targetMs = openMs + 130_000;
  const klines = [
    [openMs, 1, 1, 1, 100, 0],
    [openMs + 60_000, 1, 1, 1, 200, 0],
  ];
  const c = pickBtc1mCloseForInstant(targetMs, klines);
  if (c !== 200) fail(`pick fallback: got ${c}`);
}

function testIstRefMs() {
  const ms = istRefInstantMs('2026-04-10', 3600);
  const d = new Date(ms);
  const h = parseInt(
    d.toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false }),
    10
  );
  if (h !== 1) fail(`IST hour expected 1, got ${h} for refSec=3600`);
}

async function testResolveOrder() {
  const rw = 7;
  const refSec = refSecForWindowK(rw);
  const rKey = `2026-04-10|r${refSec}`;
  const base = {
    istDayKey: '2026-04-10',
    rw,
    loadPersisted: async () => null,
    fetchBinanceRef: async () => 999,
    loadLedgerMinEntry: async () => 11,
    logWarn: () => {},
  };

  let r = await resolveBtcUpDownOpenPrice({
    ...base,
    cacheGet: (k) => (k === rKey || String(k).endsWith('|7') ? 42 : undefined),
  });
  if (r.source !== 'cache' || r.price !== 42) fail(`resolve cache: ${JSON.stringify(r)}`);

  r = await resolveBtcUpDownOpenPrice({
    ...base,
    cacheGet: () => undefined,
    loadPersisted: async () => 88,
  });
  if (r.source !== 'db' || r.price !== 88) fail(`resolve db: ${JSON.stringify(r)}`);

  r = await resolveBtcUpDownOpenPrice({
    ...base,
    cacheGet: () => undefined,
    loadPersisted: async () => null,
    fetchBinanceRef: async () => 77,
  });
  if (r.source !== 'binance' || r.price !== 77) fail(`resolve binance: ${JSON.stringify(r)}`);

  let warned = false;
  r = await resolveBtcUpDownOpenPrice({
    ...base,
    cacheGet: () => undefined,
    loadPersisted: async () => null,
    fetchBinanceRef: async () => null,
    loadLedgerMinEntry: async () => 55.25,
    logWarn: () => {
      warned = true;
    },
  });
  if (r.source !== 'ledger_min' || r.price !== 55.25 || !warned) {
    fail(`resolve ledger: ${JSON.stringify(r)} warned=${warned}`);
  }

  r = await resolveBtcUpDownOpenPrice({
    ...base,
    cacheGet: () => undefined,
    loadPersisted: async () => null,
    fetchBinanceRef: async () => null,
    loadLedgerMinEntry: async () => null,
  });
  if (r.price != null || r.source != null) fail(`resolve empty: ${JSON.stringify(r)}`);
}

async function main() {
  testPickWithinMinute();
  testPickFallbackLastBeforeTarget();
  testIstRefMs();
  await testResolveOrder();
  console.log('btcUpDownOpenPrice tests OK');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
