/**
 * Up/Down referral: one payment per game on the referred user's first win in that game.
 * `winPercent` applies to the current one-ticket price from GameSettings (not total stake, not count of tickets).
 */
import User from '../models/User.js';
import Referral from '../models/Referral.js';
import GameSettings from '../models/GameSettings.js';
import { atomicGamesWalletUpdate } from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';
import {
  migrateLegacyFirstGameWin,
  hasFirstWinInGame,
  markFirstWinInGame,
} from '../utils/referralFirstGameWin.js';

function resolveOneTicketInr(settings, gameType) {
  const gcfg = settings?.games?.[gameType] || {};
  const t = gcfg.ticketPrice != null && Number.isFinite(Number(gcfg.ticketPrice)) ? Number(gcfg.ticketPrice) : NaN;
  if (Number.isFinite(t) && t > 0) return t;
  const globalTok = settings?.tokenValue != null && Number.isFinite(Number(settings.tokenValue)) ? Number(settings.tokenValue) : NaN;
  if (Number.isFinite(globalTok) && globalTok > 0) return globalTok;
  return 300;
}

/**
 * @param {import('mongoose').Types.ObjectId|string} referredUserId
 * @param {number} totalWinningStake - Must be &gt; 0 in this window (proves a winning leg); not used for amount.
 * @param {'btcUpDown'|'niftyUpDown'} gameType
 * @param {{ windowNumber?: number, settlementDay?: string, gameId?: string }} [meta]
 */
export async function creditReferralPerWinFromGameSettings(referredUserId, totalWinningStake, gameType, meta = {}) {
  try {
    const stakeIndicator = Number(totalWinningStake);
    if (!Number.isFinite(stakeIndicator) || stakeIndicator <= 0) {
      return { credited: false, reason: 'No winning stake' };
    }
    if (gameType !== 'btcUpDown' && gameType !== 'niftyUpDown') {
      return { credited: false, reason: 'Invalid gameType for per-win referral' };
    }

    const referredUser = await User.findById(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return { credited: false, reason: 'No referrer' };
    }
    if (referredUser.isDemo) {
      return { credited: false, reason: 'Demo users do not generate referral bonuses' };
    }

    if (migrateLegacyFirstGameWin(referredUser)) {
      await referredUser.save();
    }
    if (hasFirstWinInGame(referredUser, gameType)) {
      return { credited: false, reason: 'Already had first win in this game' };
    }

    const settings = await GameSettings.getSettings();
    const gameConfig = settings?.games?.[gameType];
    const referralConfig = gameConfig?.referralDistribution || {};
    const rewardPercent = Number(referralConfig.winPercent);
    if (!Number.isFinite(rewardPercent) || rewardPercent <= 0) {
      return { credited: false, reason: 'Referral win percent is zero or unset' };
    }

    const oneTicket = resolveOneTicketInr(settings, gameType);
    const rewardAmount = parseFloat(((oneTicket * rewardPercent) / 100).toFixed(2));
    if (rewardAmount <= 0) {
      return { credited: false, reason: 'Zero reward' };
    }

    const referrer = await User.findById(referredUser.referredBy);
    if (!referrer) {
      return { credited: false, reason: 'Referrer not found' };
    }

    const gw = await atomicGamesWalletUpdate(User, referrer._id, {
      balance: rewardAmount,
      realizedPnL: rewardAmount,
      todayRealizedPnL: rewardAmount,
    });

    const wn = meta.windowNumber;
    const day = meta.settlementDay;
    const gameLabel =
      gameType === 'btcUpDown' ? 'BTC Up/Down' : gameType === 'niftyUpDown' ? 'Nifty Up/Down' : String(gameType);
    const extra = wn != null && day ? ` (Window #${wn} · ${day})` : wn != null ? ` (Window #${wn})` : '';

    await recordGamesWalletLedger(referrer._id, {
      gameId: 'referral',
      entryType: 'credit',
      amount: rewardAmount,
      description: `Referral bonus: ${rewardPercent}% of 1× ticket (₹${oneTicket.toFixed(2)}) — ${referredUser.username}'s first win in ${gameLabel}${extra}`,
      meta: {
        gameType,
        oneTicketInr: oneTicket,
        rewardPercent,
        kind: 'first_win_one_ticket',
        windowNumber: wn,
        settlementDay: day,
        gameId: meta.gameId,
        referredUser: referredUserId,
        referredUsername: referredUser.username,
        referralBase: 'one_ticket_price',
      },
      balanceAfter: gw.balance,
    });

    await Referral.findOneAndUpdate(
      { referredUser: referredUserId },
      {
        $set: {
          'firstGameWin.credited': true,
          'firstGameWin.amount': oneTicket,
          'firstGameWin.creditedAt': new Date(),
          'firstGameWin.gameName': String(gameType),
        },
        $inc: { earnings: rewardAmount },
      }
    );

    markFirstWinInGame(referredUser, gameType);
    referredUser.referralStats.firstGameWin = true;
    referredUser.referralStats.totalReferralEarnings =
      (referredUser.referralStats?.totalReferralEarnings || 0) + rewardAmount;
    await referredUser.save();

    referrer.referralStats = referrer.referralStats || {};
    referrer.referralStats.totalReferralEarnings =
      (referrer.referralStats.totalReferralEarnings || 0) + rewardAmount;
    await referrer.save();

    return { credited: true, amount: rewardAmount };
  } catch (error) {
    console.error('[creditReferralPerWinFromGameSettings]', error);
    return { credited: false, reason: 'Error', error: error.message };
  }
}
