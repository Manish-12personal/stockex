import User from '../models/User.js';
import Referral from '../models/Referral.js';
import { atomicGamesWalletUpdate } from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';

/**
 * Credit referral reward for first game win (top 10 only)
 * @param {string} referredUserId - The user who won
 * @param {number} winAmount - The winning amount
 * @param {string} gameName - Name of the game
 * @param {number} rank - User's rank in the game (for top 10 check)
 */
export async function creditReferralGameReward(referredUserId, winAmount, gameName, rank = null) {
  try {
    const referredUser = await User.findById(referredUserId);
    if (!referredUser || !referredUser.referredBy) {
      return { credited: false, reason: 'No referrer' };
    }

    // Check if this is the first game win
    if (referredUser.referralStats?.firstGameWin) {
      return { credited: false, reason: 'Already credited first game win' };
    }

    // Check if user is in top 10 (if rank is provided)
    if (rank !== null && rank > 10) {
      return { credited: false, reason: 'Not in top 10' };
    }

    const referrer = await User.findById(referredUser.referredBy);
    if (!referrer) {
      return { credited: false, reason: 'Referrer not found' };
    }

    // Calculate 5% of win amount
    const rewardAmount = winAmount * 0.05;

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
      description: `Referral bonus: 5% of ${referredUser.username}'s first win in ${gameName}`,
      meta: {
        referredUser: referredUserId,
        referredUsername: referredUser.username,
        gameName,
        winAmount,
        rank,
        rewardPercent: 5,
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
          'firstGameWin.gameName': gameName,
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

    // Check if this is the first trading win
    if (referredUser.referralStats?.firstTradingWin) {
      return { credited: false, reason: 'Already credited first trading win' };
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
