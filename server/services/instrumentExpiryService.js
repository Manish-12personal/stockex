import Instrument from '../models/Instrument.js';
import Trade from '../models/Trade.js';
import cron from 'node-cron';

/**
 * Service to handle automatic removal of expired instruments from bid/ask
 * when users have active trades on them
 */

/**
 * Check for expired instruments and disable them if users have trades
 */
export async function checkAndDisableExpiredInstruments() {
  try {
    const now = new Date();
    
    // Find instruments that are enabled and have expired
    const expiredInstruments = await Instrument.find({
      isEnabled: true,
      expiry: { $lt: now },
      $or: [
        { instrumentType: 'FUTURES' },
        { instrumentType: 'OPTIONS' }
      ]
    }).select('_id symbol expiry');

    if (expiredInstruments.length === 0) {
      console.log('[InstrumentExpiry] No expired instruments found');
      return { processed: 0, disabled: 0 };
    }

    console.log(`[InstrumentExpiry] Found ${expiredInstruments.length} expired instruments`);

    let disabledCount = 0;

    for (const instrument of expiredInstruments) {
      // Check if there are any active trades for this instrument
      const activeTrades = await Trade.countDocuments({
        instrumentToken: instrument._id,
        status: { $in: ['open', 'pending'] }
      });

      if (activeTrades > 0) {
        // Disable the instrument to remove it from bid/ask
        await Instrument.findByIdAndUpdate(instrument._id, {
          isEnabled: false,
          adminLockedClosed: true,
          clientTemporaryOpenUntil: null,
          adminScheduledReopenAt: null
        });

        console.log(`[InstrumentExpiry] Disabled expired instrument: ${instrument.symbol} (expired: ${instrument.expiry}) - had ${activeTrades} active trades`);
        disabledCount++;
      }
    }

    console.log(`[InstrumentExpiry] Processed ${expiredInstruments.length} expired instruments, disabled ${disabledCount}`);
    return { processed: expiredInstruments.length, disabled: disabledCount };

  } catch (error) {
    console.error('[InstrumentExpiry] Error checking expired instruments:', error);
    throw error;
  }
}

/**
 * Start the cron job to check for expired instruments every 5 minutes
 */
export function startInstrumentExpiryMonitoring() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    try {
      await checkAndDisableExpiredInstruments();
    } catch (error) {
      console.error('[InstrumentExpiry] Cron job error:', error);
    }
  });

  console.log('[InstrumentExpiry] Started monitoring for expired instruments (every 5 minutes)');
}

/**
 * Manual trigger for checking expired instruments (for admin use)
 */
export async function manualCheckExpiredInstruments() {
  console.log('[InstrumentExpiry] Manual check triggered');
  return await checkAndDisableExpiredInstruments();
}
