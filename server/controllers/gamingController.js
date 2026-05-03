/**
 * Gaming Controller
 * 
 * Clean architecture implementation for user gaming operations.
 * Handles game betting, jackpot games, bracket trading, and gaming analytics.
 * 
 * Controller Responsibilities:
 * 1. Gaming request validation and response formatting
 * 2. Gaming business logic orchestration
 * 3. Game wallet operations
 * 4. Error handling and status codes
 */

import User from '../models/User.js';
import NiftyNumberBet from '../models/NiftyNumberBet.js';
import BtcNumberBet from '../models/BtcNumberBet.js';
import NiftyBracketTrade from '../models/NiftyBracketTrade.js';
import NiftyJackpotBid from '../models/NiftyJackpotBid.js';
import NiftyJackpotResult from '../models/NiftyJackpotResult.js';
import GamesWalletLedger from '../models/GamesWalletLedger.js';
import { 
  ensureGamesWallet, 
  atomicGamesWalletUpdate, 
  atomicGamesWalletDebit 
} from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';
import { getTodayISTString, startOfISTDayFromKey, endOfISTDayFromKey } from '../utils/istDate.js';
import { 
  sumUpDownSideTicketsInWindow,
  sumBracketSideTicketsInDay,
} from '../utils/gameStakeSideLimits.js';
import GameSettings from '../models/GameSettings.js';
import { 
  assertHierarchyGameNotDeniedForUserId,
  getMergedGameDenylistForPrincipal,
} from '../services/gameRestrictionService.js';
import { 
  createTransactionSlip, 
  addDebitEntry,
  addCreditEntry,
  addBrokerageDistributionEntries
} from '../services/gameTransactionSlipService.js';
import { getDummyNiftyWhenMarketClosedForTesting } from '../utils/dummyNiftyLtp.js';
import {
  isNiftyJackpotBiddingHoursBypassedForTesting,
  isNiftyBracketBiddingHoursBypassedForTesting,
} from '../utils/niftyJackpotTestMode.js';
import { isCurrentTimeWithinBracketBiddingIST } from '../utils/niftyBracketBiddingWindow.js';
import { getMarketData } from '../services/zerodhaWebSocket.js';
import { fetchNifty50LastPriceFromKite } from '../utils/kiteNiftyQuote.js';

// ==================== GAME BETTING OPERATIONS ====================

/**
 * Place game bet (up/down, number games, etc.)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const placeGameBet = async (req, res) => {
  try {
    const { gameId, betType, amount, prediction, side } = req.body;
    const userId = req.user._id;

    // Validate game access
    await assertHierarchyGameNotDeniedForUserId(userId, gameId);

    // Get game settings
    const settings = await GameSettings.getSettings();
    const gameConfig = settings?.games?.[gameId];
    
    if (!gameConfig || !gameConfig.enabled) {
      return res.status(400).json({ message: 'Game is not available' });
    }

    // Check minimum bet amount
    if (amount < gameConfig.minBet || amount > gameConfig.maxBet) {
      return res.status(400).json({ 
        message: `Bet amount must be between ${gameConfig.minBet} and ${gameConfig.maxBet}` 
      });
    }

    // Ensure user has sufficient games wallet balance
    await ensureGamesWallet(userId);
    const walletDebit = await atomicGamesWalletDebit(userId, amount);
    
    if (!walletDebit.success) {
      return res.status(400).json({ message: 'Insufficient games wallet balance' });
    }

    // Create transaction slip
    const transactionId = `GAME_${gameId}_${Date.now()}_${userId}`;
    const slip = await createTransactionSlip(transactionId, userId, gameId);

    // Add debit entry to transaction slip
    await addDebitEntry(slip._id, amount, `Game bet - ${gameId}`);

    // Record games wallet ledger
    await recordGamesWalletLedger(userId, 'DEBIT', amount, `Game bet - ${gameId}`, slip._id);

    // Create game-specific bet record based on game type
    let betRecord;
    switch (gameId) {
      case 'updown':
      case 'btcupdown':
        betRecord = await placeUpDownBet(userId, gameId, amount, side, slip._id);
        break;
      case 'niftyNumber':
      case 'btcNumber':
        betRecord = await placeNumberBet(userId, gameId, amount, prediction, slip._id);
        break;
      case 'niftyBracket':
        betRecord = await placeBracketBet(userId, amount, prediction, slip._id);
        break;
      case 'niftyJackpot':
      case 'btcJackpot':
        betRecord = await placeJackpotBet(userId, gameId, amount, prediction, slip._id);
        break;
      default:
        return res.status(400).json({ message: 'Invalid game type' });
    }

    res.status(201).json({
      message: 'Bet placed successfully',
      bet: {
        id: betRecord._id,
        gameId,
        amount,
        prediction,
        side,
        transactionId: slip._id,
        createdAt: betRecord.createdAt
      }
    });
  } catch (error) {
    console.error('[GamingController] Error placing game bet:', error);
    res.status(500).json({ message: 'Failed to place bet', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
  }
};

// ==================== GAME WALLET OPERATIONS ====================

/**
 * Get games wallet ledger
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameWalletLedger = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 500);
    const gameId = req.query.gameId || '';
    const date = req.query.date || '';
    
    let query = { ownerType: 'USER', ownerId: req.user._id };
    
    if (gameId) {
      query.description = { $regex: new RegExp(gameId, 'i') };
    }
    
    if (date) {
      const dayStart = startOfISTDayFromKey(date);
      const dayEnd = endOfISTDayFromKey(date);
      query.createdAt = { $gte: dayStart, $lte: dayEnd };
    }
    
    const ledger = await GamesWalletLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json({
      ledger,
      total: ledger.length,
      query: { gameId, date, limit }
    });
  } catch (error) {
    console.error('[GamingController] Error getting game wallet ledger:', error);
    res.status(500).json({ message: 'Failed to get wallet ledger' });
  }
};

/**
 * Get games wallet today's net change
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameTodayNet = async (req, res) => {
  try {
    const today = getTodayISTString();
    const dayStart = startOfISTDayFromKey(today);
    const dayEnd = endOfISTDayFromKey(today);
    
    const ledger = await GamesWalletLedger.find({
      ownerType: 'USER',
      ownerId: req.user._id,
      createdAt: { $gte: dayStart, $lte: dayEnd }
    });
    
    // Calculate net change per game
    const netByGame = {};
    ledger.forEach(entry => {
      const gameId = extractGameIdFromDescription(entry.description);
      if (!netByGame[gameId]) {
        netByGame[gameId] = { credits: 0, debits: 0, net: 0 };
      }
      if (entry.type === 'CREDIT') {
        netByGame[gameId].credits += entry.amount;
      } else {
        netByGame[gameId].debits += entry.amount;
      }
      netByGame[gameId].net = netByGame[gameId].credits - netByGame[gameId].debits;
    });
    
    res.json({
      date: today,
      netByGame,
      totalNet: Object.values(netByGame).reduce((sum, game) => sum + game.net, 0)
    });
  } catch (error) {
    console.error('[GamingController] Error getting today\'s net change:', error);
    res.status(500).json({ message: 'Failed to get today\'s net change' });
  }
};

// ==================== GAME ANALYTICS ====================

/**
 * Get live game activity
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameLiveActivity = async (req, res) => {
  try {
    const settings = await GameSettings.getSettings().catch(() => null);
    const dayKey = getTodayISTString();
    const dayStart = startOfISTDayFromKey(dayKey);
    
    const activity = {};
    
    // Get activity for each game
    const games = ['btcupdown', 'updown', 'niftyNumber', 'niftyBracket', 'niftyJackpot'];
    
    for (const gameId of games) {
      const upDownTickets = await sumUpDownSideTicketsInWindow(gameId, dayStart, new Date());
      const bracketTickets = await sumBracketSideTicketsInDay(gameId, dayKey);
      
      activity[gameId] = {
        totalTickets: (upDownTickets.up + upDownTickets.down) || bracketTickets.total || 0,
        upTickets: upDownTickets.up || 0,
        downTickets: upDownTickets.down || 0,
        bracketTotal: bracketTickets.total || 0,
        lastUpdated: new Date()
      };
    }
    
    res.json({
      activity,
      timestamp: new Date(),
      settings: settings?.games || {}
    });
  } catch (error) {
    console.error('[GamingController] Error getting live activity:', error);
    res.status(500).json({ message: 'Failed to get live activity' });
  }
};

/**
 * Get recent winners
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameRecentWinners = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 15, 1), 40);
    
    const winners = await GamesWalletLedger.find({
      ownerType: 'USER',
      ownerId: req.user._id,
      type: 'CREDIT',
      description: { $regex: /win|prize|jackpot/i }
    })
    .sort({ createdAt: -1 })
    .limit(limit);
    
    res.json({
      winners: winners.map(entry => ({
        id: entry._id,
        amount: entry.amount,
        description: entry.description,
        balance: entry.balance,
        createdAt: entry.createdAt
      }))
    });
  } catch (error) {
    console.error('[GamingController] Error getting recent winners:', error);
    res.status(500).json({ message: 'Failed to get recent winners' });
  }
};

/**
 * Get game statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const gameId = req.query.gameId || '';
    
    // Get user's game statistics
    let stats = {
      totalBets: 0,
      totalWins: 0,
      totalLosses: 0,
      totalWagered: 0,
      totalWon: 0,
      netProfit: 0,
      winRate: 0,
      averageBet: 0
    };
    
    // Get ledger entries for calculations
    let query = { ownerType: 'USER', ownerId: userId };
    if (gameId) {
      query.description = { $regex: new RegExp(gameId, 'i') };
    }
    
    const ledger = await GamesWalletLedger.find(query);
    
    ledger.forEach(entry => {
      if (entry.type === 'DEBIT') {
        stats.totalBets++;
        stats.totalWagered += entry.amount;
      } else if (entry.type === 'CREDIT') {
        if (entry.description.includes('win') || entry.description.includes('prize')) {
          stats.totalWins++;
          stats.totalWon += entry.amount;
        }
      }
    });
    
    stats.totalLosses = stats.totalBets - stats.totalWins;
    stats.netProfit = stats.totalWon - stats.totalWagered;
    stats.winRate = stats.totalBets > 0 ? (stats.totalWins / stats.totalBets) * 100 : 0;
    stats.averageBet = stats.totalBets > 0 ? stats.totalWagered / stats.totalBets : 0;
    
    res.json({
      stats,
      gameId: gameId || 'all',
      totalEntries: ledger.length
    });
  } catch (error) {
    console.error('[GamingController] Error getting game stats:', error);
    res.status(500).json({ message: 'Failed to get game statistics' });
  }
};

/**
 * Get game history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getGameHistory = async (req, res) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const gameId = req.query.gameId || '';
    const date = req.query.date || '';
    
    let query = { ownerType: 'USER', ownerId: req.user._id };
    
    if (gameId) {
      query.description = { $regex: new RegExp(gameId, 'i') };
    }
    
    if (date) {
      const dayStart = startOfISTDayFromKey(date);
      const dayEnd = endOfISTDayFromKey(date);
      query.createdAt = { $gte: dayStart, $lte: dayEnd };
    }
    
    const history = await GamesWalletLedger.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);
    
    res.json({
      history,
      total: history.length,
      query: { gameId, date, limit }
    });
  } catch (error) {
    console.error('[GamingController] Error getting game history:', error);
    res.status(500).json({ message: 'Failed to get game history' });
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Place up/down bet
 */
async function placeUpDownBet(userId, gameId, amount, side, transactionId) {
  const BetModel = gameId === 'btcupdown' ? BtcNumberBet : NiftyNumberBet;
  
  return await BetModel.create({
    user: userId,
    amount,
    side,
    transactionId,
    status: 'PENDING',
    createdAt: new Date()
  });
}

/**
 * Place number bet
 */
async function placeNumberBet(userId, gameId, amount, prediction, transactionId) {
  const BetModel = gameId === 'btcNumber' ? BtcNumberBet : NiftyNumberBet;
  
  return await BetModel.create({
    user: userId,
    amount,
    prediction,
    transactionId,
    status: 'PENDING',
    createdAt: new Date()
  });
}

/**
 * Place bracket bet
 */
async function placeBracketBet(userId, amount, prediction, transactionId) {
  return await NiftyBracketTrade.create({
    user: userId,
    amount,
    prediction,
    transactionId,
    status: 'PENDING',
    createdAt: new Date()
  });
}

/**
 * Place jackpot bet
 */
async function placeJackpotBet(userId, gameId, amount, prediction, transactionId) {
  return await NiftyJackpotBid.create({
    user: userId,
    gameId,
    amount,
    prediction,
    transactionId,
    status: 'PENDING',
    createdAt: new Date()
  });
}

/**
 * Extract game ID from description
 */
function extractGameIdFromDescription(description) {
  const gameIds = ['updown', 'btcupdown', 'niftyNumber', 'btcNumber', 'niftyBracket', 'niftyJackpot', 'btcJackpot'];
  
  for (const gameId of gameIds) {
    if (description.toLowerCase().includes(gameId.toLowerCase())) {
      return gameId;
    }
  }
  
  return 'unknown';
}
