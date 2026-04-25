import User from '../models/User.js';
import Referral from '../models/Referral.js';
import { atomicGamesWalletUpdate } from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';
import GameSettings from '../models/GameSettings.js';
import {
  migrateLegacyFirstGameWin,
  hasFirstWinInGame,
  markFirstWinInGame,
} from '../utils/referralFirstGameWin.js';

/**
 * Credit referral reward for game win (based on game-specific percentage)
 * @param {string} referredUserId - The user who won
 * @param {number} winAmount - Base for % (e.g. prize, day bank) depending on game
 * @param {string} gameType - GameSettings key (e.g. 'niftyUpDown', 'btcUpDown', 'niftyJackpot', 'btcJackpot')
 * @param {number} rank - User's rank in the game (for top ranks check in jackpot)
 */
export async function creditReferralGameReward(referredUserId, winAmount, gameType, rank = null) {
  try {
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
    if (!gameConfig) {
      return { credited: false, reason: 'Unknown game in settings' };
    }
    const referralConfig = gameConfig?.referralDistribution || {};

    if (referralConfig.topRanksOnly && rank !== null) {
      if (rank > referralConfig.topRanksCount) {
        return { credited: false, reason: `Not in top ${referralConfig.topRanksCount}` };
      }
    }

    if (rank !== null && !referralConfig.topRanksOnly && rank > 10) {
      return { credited: false, reason: 'Not in top 10' };
    }

    if (referredUser.convertedToRealAt) {
      const oneMonthAfterConversion = new Date(referredUser.convertedToRealAt);
      oneMonthAfterConversion.setMonth(oneMonthAfterConversion.getMonth() + 1);
      const now = new Date();
      if (now > oneMonthAfterConversion) {
        return { credited: false, reason: 'First win window (1 month after conversion) has expired' };
      }
    }

    const referrer = await User.findById(referredUser.referredBy);
    if (!referrer) {
      return { credited: false, reason: 'Referrer not found' };
    }

    const rewardPercent = referralConfig.winPercent || 5;
    const rewardAmount = winAmount * (rewardPercent / 100);

    const isBtcJackpotKey = gameType === 'btcJackpot';
    const referralDescription = isBtcJackpotKey
      ? `Referral bonus: ${rewardPercent}% of BTC Jackpot day bank (₹${Number(winAmount).toFixed(2)}) — ${referredUser.username}'s first game win in BTC Jackpot`
      : `Referral bonus: ${rewardPercent}% of ${referredUser.username}'s first win in ${gameType}`;

    const gw = await atomicGamesWalletUpdate(User, referrer._id, {
      balance: rewardAmount,
      realizedPnL: rewardAmount,
      todayRealizedPnL: rewardAmount,
    });

    await recordGamesWalletLedger(referrer._id, {
      gameId: 'referral',
      entryType: 'credit',
      amount: rewardAmount,
      description: referralDescription,
      meta: {
        referredUser: referredUserId,
        referredUsername: referredUser.username,
        gameType,
        winAmount,
        rank,
        rewardPercent,
        ...(isBtcJackpotKey && { referralBase: 'btc_jackpot_day_bank', dayBankINR: winAmount }),
      },
      balanceAfter: gw.balance,
    });

    await Referral.findOneAndUpdate(
      { referredUser: referredUserId },
      {
        $set: {
          'firstGameWin.credited': true,
          'firstGameWin.amount': winAmount,
          'firstGameWin.creditedAt': new Date(),
          'firstGameWin.gameName': String(gameType),
        },
        $inc: { earnings: rewardAmount },
      }
    );

    markFirstWinInGame(referredUser, gameType);
    referredUser.referralStats.firstGameWin = true;
    referredUser.referralStats.totalReferralEarnings = (referredUser.referralStats.totalReferralEarnings || 0) + rewardAmount;
    await referredUser.save();

    referrer.referralStats.totalReferralEarnings = (referrer.referralStats.totalReferralEarnings || 0) + rewardAmount;
    await referrer.save();

    return { credited: true, amount: rewardAmount };
  } catch (error) {
    console.error('Error crediting referral game reward:', error);
    return { credited: false, reason: 'Error', error: error.message };
  }
}

/**
 * Credit referral reward for first trading win (brokerage amount)
 * @param {string} referredUserId - The user who won
 * @param {number} brokerageAmount - The brokerage amount
 * @param {string} tradeId - The trade ID
 */
export async function creditReferralTradingReward(referredUserId, brokerageAmount, tradeId) {
  try {
    const referredUser = await User.findById(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return { credited: false, reason: 'No referrer' };
    }

    if (referredUser.isDemo) {
      return { credited: false, reason: 'Demo users do not generate referral bonuses' };
    }

    if (referredUser.referralStats?.firstTradingWin) {
      return { credited: false, reason: 'Already credited first trading win' };
    }

    if (referredUser.convertedToRealAt) {
      const oneMonthAfterConversion = new Date(referredUser.convertedToRealAt);
      oneMonthAfterConversion.setMonth(oneMonthAfterConversion.getMonth() + 1);
      const now = new Date();
      if (now > oneMonthAfterConversion) {
        return { credited: false, reason: 'First win window (1 month after conversion) has expired' };
      }
    }

    const referrer = await User.findById(referredUser.referredBy);
    if (!referrer) {
      return { credited: false, reason: 'Referrer not found' };
    }

    referrer.wallet.cashBalance += brokerageAmount;
    referrer.wallet.tradingBalance += brokerageAmount;
    referrer.wallet.realizedPnL += brokerageAmount;
    referrer.wallet.todayRealizedPnL += brokerageAmount;
    referrer.wallet.transactions.push({
      type: 'credit',
      amount: brokerageAmount,
      description: `Referral bonus: Brokerage from ${referredUser.username}'s first winning trade`,
      createdAt: new Date(),
    });
    referrer.referralStats.totalReferralEarnings = (referrer.referralStats.totalReferralEarnings || 0) + brokerageAmount;
    await referrer.save();

    await Referral.findOneAndUpdate(
      { referredUser: referredUserId },
      {
        $set: {
          'firstTradingWin.credited': true,
          'firstTradingWin.amount': brokerageAmount,
          'firstTradingWin.creditedAt': new Date(),
        },
        $inc: { earnings: brokerageAmount },
      }
    );

    referredUser.referralStats.firstTradingWin = true;
    referredUser.referralStats.totalReferralEarnings = (referredUser.referralStats.totalReferralEarnings || 0) + brokerageAmount;
    await referredUser.save();

    return { credited: true, amount: brokerageAmount };
  } catch (error) {
    console.error('Error crediting referral trading reward:', error);
    return { credited: false, reason: 'Error', error: error.message };
  }
}
