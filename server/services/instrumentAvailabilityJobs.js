import Instrument from '../models/Instrument.js';

/** Disable instruments whose client-requested temporary window has passed. */
export async function expireClientTemporaryInstrumentOpens() {
  const now = new Date();
  const result = await Instrument.updateMany(
    {
      isEnabled: true,
      clientTemporaryOpenUntil: { $ne: null, $lte: now }
    },
    {
      $set: {
        isEnabled: false,
        clientTemporaryOpenUntil: null
      }
    }
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[instruments] Auto-disabled ${result.modifiedCount} instrument(s) after temporary client access expired`
    );
  }
  return result;
}

/** Re-enable instruments when Super Admin scheduled date/time is reached. */
export async function applyAdminScheduledInstrumentReopens() {
  const now = new Date();
  const result = await Instrument.updateMany(
    {
      isEnabled: false,
      adminScheduledReopenAt: { $ne: null, $lte: now }
    },
    {
      $set: {
        isEnabled: true,
        adminLockedClosed: false,
        adminScheduledReopenAt: null,
        clientTemporaryOpenUntil: null
      }
    }
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[instruments] Auto-reopened ${result.modifiedCount} instrument(s) per Super Admin schedule`
    );
  }
  return result;
}

export async function runInstrumentAvailabilityTicks() {
  await expireClientTemporaryInstrumentOpens();
  await applyAdminScheduledInstrumentReopens();
}
