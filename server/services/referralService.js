import User from '../models/User.js';
import Referral from '../models/Referral.js';
import { atomicGamesWalletUpdate } from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';
import GameSettings from '../models/GameSettings.js';

/**
 * Credit referral reward for game win (based on game-specific percentage)
 * @param {string} referredUserId - The user who won
 * @param {number} winAmount - The winning amount
 * @param {string} gameType - Game type (e.g., 'niftyUpDown', 'btcUpDown', 'niftyNumber', 'niftyBracket', 'niftyJackpot')
 * @param {number} rank - User's rank in the game (for top ranks check in jackpot)
 */
export async function creditReferralGameReward(referredUserId, winAmount, gameType, rank = null) {
  try {
    const referredUser = await User.findById(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return { credited: false, reason: 'No referrer' };
    }

    // Exclude demo users from referral bonuses
    if (referredUser.isDemo) {
      return { credited: false, reason: 'Demo users do not generate referral bonuses' };
    }

    // Check if this is the first game win
    if (referredUser.referralStats?.firstGameWin) {
      return { credited: false, reason: 'Already credited first game win' };
    }

    // Fetch game settings to get referral distribution percentage
    const settings = await GameSettings.getSettings();
    const gameConfig = settings?.games?.[gameType];
    const referralConfig = gameConfig?.referralDistribution || {};

    // Check if game has top ranks restriction (e.g., Nifty Jackpot)
    if (referralConfig.topRanksOnly && rank !== null) {
      if (rank > referralConfig.topRanksCount) {
        return { credited: false, reason: `Not in top ${referralConfig.topRanksCount}` };
      }
    }

    // Check if user is in top 10 (if rank is provided and no topRanksOnly setting)
    if (rank !== null && !referralConfig.topRanksOnly && rank > 10) {
      return { credited: false, reason: 'Not in top 10' };
    }

    // Check if user converted from demo to real - only count wins within 1 month of conversion
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

    // Calculate reward amount using game-specific percentage (default to 5% if not set)
    const rewardPercent = referralConfig.winPercent || 5;
    const rewardAmount = winAmount * (rewardPercent / 100);

    // Credit to referrer's games wallet
    const gw = await atomicGamesWalletUpdate(User, referrer._id, {
      balance: rewardAmount,
      realizedPnL: rewardAmount,
      todayRealizedPnL: rewardAmount,
    });

    // Record ledger entry
    await recordGamesWalletLedger(referrer._id, {
      gameId: 'referral',
      entryType: 'credit',
      amount: rewardAmount,
      description: `Referral bonus: ${rewardPercent}% of ${referredUser.username}'s first win in ${gameType}`,
      meta: {
        referredUser: referredUserId,
        referredUsername: referredUser.username,
        gameType,
        winAmount,
        rank,
        rewardPercent,
      },
      balanceAfter: gw.balance,
    });

    // Update referral record
    await Referral.findOneAndUpdate(
      { referredUser: referredUserId },
      {
        $set: {
          'firstGameWin.credited': true,
          'firstGameWin.amount': winAmount,
          'firstGameWin.creditedAt': new Date(),
          'firstGameWin.gameType': gameType,
          earnings: (await Referral.findOne({ referredUser: referredUserId }))?.earnings + rewardAmount || rewardAmount,
        },
      }
    );

    // Mark user's first game win as credited
    referredUser.referralStats.firstGameWin = true;
    referredUser.referralStats.totalReferralEarnings = (referredUser.referralStats.totalReferralEarnings || 0) + rewardAmount;
    await referredUser.save();

    // Update referrer's total referral earnings
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

    // Exclude demo users from referral bonuses
    if (referredUser.isDemo) {
      return { credited: false, reason: 'Demo users do not generate referral bonuses' };
    }

    // Check if this is the first trading win
    if (referredUser.referralStats?.firstTradingWin) {
      return { credited: false, reason: 'Already credited first trading win' };
    }

    // Check if user converted from demo to real - only count wins within 1 month of conversion
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

    // Credit brokerage amount to referrer's main wallet
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

    // Update referral record
    await Referral.findOneAndUpdate(
      { referredUser: referredUserId },
      {
        $set: {
          'firstTradingWin.credited': true,
          'firstTradingWin.amount': brokerageAmount,
          'firstTradingWin.creditedAt': new Date(),
          earnings: (await Referral.findOne({ referredUser: referredUserId }))?.earnings + brokerageAmount || brokerageAmount,
        },
      }
    );

    // Mark user's first trading win as credited
    referredUser.referralStats.firstTradingWin = true;
    referredUser.referralStats.totalReferralEarnings = (referredUser.referralStats.totalReferralEarnings || 0) + brokerageAmount;
    await referredUser.save();

    return { credited: true, amount: brokerageAmount };
  } catch (error) {
    console.error('Error crediting referral trading reward:', error);
    return { credited: false, reason: 'Error', error: error.message };
  }
}
