import GameSettings from '../models/GameSettings.js';
import BtcJackpotBid from '../models/BtcJackpotBid.js';
import BtcJackpotResult from '../models/BtcJackpotResult.js';
import BtcJackpotBank from '../models/BtcJackpotBank.js';
import { btcJackpotDayFilter } from '../utils/btcJackpotDay.js';
import { getLiveBtcSpotForJackpot } from '../utils/btcJackpotSpot.js';
import { declareBtcJackpotForDate } from '../services/btcJackpotDeclareService.js';
import { getTodayISTString } from '../utils/istDate.js';

function istSecondsNow() {
  const t = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
  const [hh = '0', mm = '0', ss = '0'] = t.split(':');
  return (parseInt(hh, 10) || 0) * 3600 + (parseInt(mm, 10) || 0) * 60 + (parseInt(ss, 10) || 0);
}

function parseTimeToSecIST(str) {
  const parts = String(str || '23:30').split(':').map((x) => parseInt(x, 10));
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
}

let running = false;

/**
 * BTC Jackpot dynamic result tick. Runs every N seconds from server/index.js.
 * Steps:
 *   1. Skip if disabled, or current IST < configured resultTime.
 *   2. If no locked BTC price row for today, fetch Binance spot and upsert one.
 *   3. If locked row exists and not yet declared, invoke the declare service.
 *
 * Uses a local single-flight guard (`running`) so overlapping ticks no-op.
 */
export async function btcJackpotAutoTick() {
  if (running) return;
  running = true;
  try {
    if (String(process.env.BTC_JACKPOT_AUTO_SETTLEMENT || 'true').toLowerCase() === 'false') return;

    const settings = await GameSettings.getSettings().catch(() => null);
    const gc = settings?.games?.btcJackpot;
    if (!gc || gc.enabled === false) return;

    const resultSec = parseTimeToSecIST(gc.resultTime || '23:30');
    if (istSecondsNow() < resultSec) return;

    const today = getTodayISTString();
    let row = await BtcJackpotResult.findOne({ resultDate: today });

    if (!row || row.lockedBtcPrice == null || !Number.isFinite(Number(row.lockedBtcPrice)) || Number(row.lockedBtcPrice) <= 0) {
      const pending = await BtcJackpotBid.countDocuments({
        $and: [{ status: 'pending' }, btcJackpotDayFilter(today)],
      });
      if (pending === 0) return;

      const spot = await getLiveBtcSpotForJackpot();
      if (spot.price == null || !Number.isFinite(spot.price) || spot.price <= 0) {
        console.warn('[btcJackpot] auto-lock: no BTC price available — retrying next tick');
        return;
      }

      try {
        row = await BtcJackpotResult.findOneAndUpdate(
          { resultDate: today },
          {
            $setOnInsert: {
              resultDate: today,
              lockedBtcPrice: Number(spot.price),
              lockedAt: new Date(),
              lockedSource: spot.source || 'binance_rest',
            },
          },
          { upsert: true, new: true }
        );

        await BtcJackpotBank.findOneAndUpdate(
          { betDate: today },
          {
            $setOnInsert: { betDate: today },
            $set: { lockedBtcPrice: Number(spot.price), lockedAt: new Date() },
          },
          { upsert: true, new: true }
        );

        console.log(
          `[btcJackpot] auto-locked @ $${Number(spot.price).toFixed(2)} for ${today} (IST ≥ ${gc.resultTime || '23:30'}, source=${spot.source})`
        );
      } catch (e) {
        if (e?.code !== 11000) console.warn('[btcJackpot] auto-lock:', e?.message || e);
      }
    }

    const fresh = await BtcJackpotResult.findOne({ resultDate: today }).lean();
    if (!fresh || fresh.resultDeclared) return;
    if (!Number.isFinite(Number(fresh.lockedBtcPrice)) || Number(fresh.lockedBtcPrice) <= 0) return;

    try {
      const out = await declareBtcJackpotForDate(today);
      console.log(
        `[btcJackpot] declared ${today}: ${out.summary.winnersCount}W / ${out.summary.losersCount}L, paid ₹${out.summary.totalPaidOut.toFixed(2)}`
      );
    } catch (e) {
      if (!String(e?.message || '').includes('No pending') && !String(e?.message || '').includes('already declared')) {
        console.warn('[btcJackpot] declare:', e?.message || e);
      }
    }
  } catch (e) {
    console.warn('[btcJackpot] tick error:', e?.message || e);
  } finally {
    running = false;
  }
}
