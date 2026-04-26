/**
 * BTC / Nifty Up-Down: referral when the referred user has a winning leg in a settled window.
 * Delegates to creditReferralPercentOfTotalStake (total window stake × winPercent, once per window).
 */
import { creditReferralPercentOfTotalStake } from './referralGameStakeCredit.js';

/**
 * @param {import('mongoose').Types.ObjectId|string} referredUserId
 * @param {number} totalWinningStake - Must be &gt; 0 (at least one winning leg this settlement).
 * @param {'btcUpDown'|'niftyUpDown'} gameType
 * @param {{ windowNumber?: number, settlementDay?: string, gameId?: string, totalStakeInWindow?: number }} [meta]
 */
export async function creditReferralPerWinFromGameSettings(referredUserId, totalWinningStake, gameType, meta = {}) {
  const stakeIndicator = Number(totalWinningStake);
  if (!Number.isFinite(stakeIndicator) || stakeIndicator <= 0) {
    return { credited: false, reason: 'No winning stake' };
  }
  if (gameType !== 'btcUpDown' && gameType !== 'niftyUpDown') {
    return { credited: false, reason: 'Invalid gameType for per-win referral' };
  }

  const totalStake = Number(meta.totalStakeInWindow);
  if (!Number.isFinite(totalStake) || totalStake <= 0) {
    return { credited: false, reason: 'Invalid totalStakeInWindow' };
  }

  const wn = meta.windowNumber != null ? Number(meta.windowNumber) : null;
  const day = meta.settlementDay != null ? String(meta.settlementDay).trim() : '';
  if (!Number.isFinite(wn) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return { credited: false, reason: 'Missing windowNumber or settlementDay for referral idempotency' };
  }

  return creditReferralPercentOfTotalStake({
    referredUserId,
    gameType,
    totalStake,
    settlementDay: day,
    sessionScope: `w${wn}`,
    rank: null,
  });
}
