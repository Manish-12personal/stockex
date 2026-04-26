/**
 * Shared games referral: winPercent from GameSettings × total stake for the session (window / declare day / trade).
 * One credit per (referred user, gameKey, settlementDay, sessionScope) via WalletLedger idempotency.
 * Credits referrer main wallet + REFERRAL_COMMISSION ledger (same as Up/Down stake referrals).
 */
import mongoose from 'mongoose';
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import GameSettings from '../models/GameSettings.js';
import WalletLedger from '../models/WalletLedger.js';

const GAME_LABELS = {
  btcUpDown: 'BTC Up/Down',
  niftyUpDown: 'Nifty Up/Down',
  niftyNumber: 'Nifty Number',
  btcNumber: 'BTC Number',
  niftyBracket: 'Nifty Bracket',
  niftyJackpot: 'Nifty Jackpot',
  btcJackpot: 'BTC Jackpot',
};

function labelFor(gameType) {
  return GAME_LABELS[gameType] || String(gameType);
}

/**
 * @param {object} params
 * @param {import('mongoose').Types.ObjectId|string} params.referredUserId
 * @param {string} params.gameType - GameSettings games.* key
 * @param {number} params.totalStake - Sum of stakes for this session (e.g. all legs or all user bids that day)
 * @param {string} params.settlementDay - YYYY-MM-DD (IST calendar anchor)
 * @param {string} params.sessionScope - Unique within day+game: e.g. `w42`, `declare`, or trade id
 * @param {number|null} [params.rank] - Optional rank for jackpot top-N settings
 * @returns {Promise<{ credited: boolean, amount?: number, reason?: string, error?: string }>}
 */
export async function creditReferralPercentOfTotalStake({
  referredUserId,
  gameType,
  totalStake,
  settlementDay,
  sessionScope,
  rank = null,
}) {
  try {
    const stake = Number(totalStake);
    if (!Number.isFinite(stake) || stake <= 0) {
      return { credited: false, reason: 'Invalid total stake' };
    }
    const day = String(settlementDay || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
      return { credited: false, reason: 'Invalid settlementDay' };
    }
    const scope = String(sessionScope || '').trim();
    if (!scope) {
      return { credited: false, reason: 'sessionScope required' };
    }

    const referredUser = await User.findById(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return { credited: false, reason: 'No referrer' };
    }
    if (referredUser.isDemo) {
      return { credited: false, reason: 'Demo users do not generate referral bonuses' };
    }

    if (referredUser.convertedToRealAt) {
      const oneMonthAfter = new Date(referredUser.convertedToRealAt);
      oneMonthAfter.setMonth(oneMonthAfter.getMonth() + 1);
      if (new Date() > oneMonthAfter) {
        return { credited: false, reason: 'Referral window (1 month after conversion) has expired' };
      }
    }

    const settings = await GameSettings.getSettings();
    const gameConfig = settings?.games?.[gameType];
    if (!gameConfig) {
      return { credited: false, reason: 'Unknown game in settings' };
    }
    const referralConfig = gameConfig?.referralDistribution || {};

    if (referralConfig.topRanksOnly && rank != null) {
      const topN = Number(referralConfig.topRanksCount);
      if (Number.isFinite(topN) && topN > 0 && rank > topN) {
        return { credited: false, reason: `Not in top ${topN}` };
      }
    }

    if (rank != null && !referralConfig.topRanksOnly && rank > 10) {
      return { credited: false, reason: 'Not in top 10' };
    }

    const rewardPercent = Number(referralConfig.winPercent);
    if (!Number.isFinite(rewardPercent) || rewardPercent <= 0) {
      return { credited: false, reason: 'Referral win percent is zero or unset' };
    }

    const referredOid =
      typeof referredUserId === 'string' && mongoose.Types.ObjectId.isValid(referredUserId)
        ? new mongoose.Types.ObjectId(referredUserId)
        : referredUserId;

    const existing = await WalletLedger.findOne({
      ownerType: 'USER',
      reason: 'REFERRAL_COMMISSION',
      type: 'CREDIT',
      'meta.kind': 'game_stake_referral',
      'meta.relatedUserId': referredOid,
      'meta.gameKey': gameType,
      'meta.settlementDay': day,
      'meta.sessionScope': scope,
    }).lean();
    if (existing) {
      return { credited: false, reason: 'Already credited for this session' };
    }

    const referrer = await User.findById(referredUser.referredBy);
    if (!referrer) {
      return { credited: false, reason: 'Referrer not found' };
    }

    const rewardAmount = parseFloat(((stake * rewardPercent) / 100).toFixed(2));
    if (rewardAmount <= 0) {
      return { credited: false, reason: 'Zero reward' };
    }

    const gl = labelFor(gameType);
    const rankBit = rank != null ? ` (rank ${rank})` : '';
    const description = `Referral bonus: ${rewardPercent}% of total stake (₹${stake.toFixed(2)}) — ${referredUser.username} in ${gl}${rankBit} · ${day} · ${scope}`;

    referrer.wallet = referrer.wallet || {};
    referrer.wallet.cashBalance = (referrer.wallet.cashBalance || 0) + rewardAmount;
    referrer.wallet.tradingBalance = (referrer.wallet.tradingBalance || 0) + rewardAmount;
    referrer.wallet.realizedPnL = (referrer.wallet.realizedPnL || 0) + rewardAmount;
    referrer.wallet.todayRealizedPnL = (referrer.wallet.todayRealizedPnL || 0) + rewardAmount;
    referrer.wallet.balance = (referrer.wallet.balance || 0) + rewardAmount;
    referrer.referralStats = referrer.referralStats || {};
    referrer.referralStats.totalReferralEarnings =
      (referrer.referralStats.totalReferralEarnings || 0) + rewardAmount;
    await referrer.save();

    await WalletLedger.create({
      ownerType: 'USER',
      ownerId: referrer._id,
      userId: referrer._id,
      username: referrer.username,
      type: 'CREDIT',
      reason: 'REFERRAL_COMMISSION',
      amount: rewardAmount,
      balanceAfter: referrer.wallet.balance,
      description,
      meta: {
        profitKind: 'REFERRAL_COMMISSION',
        gameKey: gameType,
        relatedUserId: referredOid,
        segment: 'games',
        rewardPercent,
        kind: 'game_stake_referral',
        settlementDay: day,
        sessionScope: scope,
        referralBase: 'total_session_stake',
        totalStakeInSession: stake,
        referredUsername: referredUser.username,
        ...(rank != null ? { rank } : {}),
      },
    });

    await Referral.findOneAndUpdate({ referredUser: referredOid }, { $inc: { earnings: rewardAmount } });

    return { credited: true, amount: rewardAmount };
  } catch (error) {
    console.error('[creditReferralPercentOfTotalStake]', error);
    return { credited: false, reason: 'Error', error: error.message };
  }
}
