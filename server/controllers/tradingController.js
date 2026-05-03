/**
 * Trading Controller
 * 
 * Clean architecture implementation for user trading operations.
 * Handles user positions, trades, and trading analytics.
 * 
 * Controller Responsibilities:
 * 1. Trading request validation and response formatting
 * 2. Trading business logic orchestration
 * 3. Position management
 * 4. Error handling and status codes
 */

import User from '../models/User.js';
import Trade from '../models/Trade.js';
import Position from '../models/Position.js';
import TradeService from '../services/tradeService.js';

// ==================== USER POSITIONS ====================

/**
 * Get user positions
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserPositions = async (req, res) => {
  try {
    const userId = req.user._id;
    const status = req.query.status || 'OPEN';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 1) || 1, 1);
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { user: userId };
    if (status !== 'ALL') {
      query.status = status;
    }
    
    // Get positions
    const positions = await Position.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('trade', 'symbol segment instrumentType exchange');
    
    // Get total count for pagination
    const total = await Position.countDocuments(query);
    
    // Calculate P&L for each position
    const formattedPositions = positions.map(position => {
      const pnl = calculatePositionPnL(position);
      return {
        id: position._id,
        trade: position.trade,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        pnl: pnl,
        pnlPercent: position.entryPrice > 0 ? (pnl / (position.entryPrice * position.quantity)) * 100 : 0,
        status: position.status,
        segment: position.segment,
        instrumentType: position.instrumentType,
        exchange: position.exchange,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt
      };
    });
    
    res.json({
      positions: formattedPositions,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[TradingController] Error getting user positions:', error);
    res.status(500).json({ message: 'Failed to get positions' });
  }
};

/**
 * Get user trades
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserTrades = async (req, res) => {
  try {
    const userId = req.user._id;
    const status = req.query.status || 'ALL';
    const segment = req.query.segment || '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const page = Math.max(parseInt(req.query.page, 1) || 1, 1);
    const skip = (page - 1) * limit;
    
    // Build query
    let query = { user: userId };
    if (status !== 'ALL') {
      query.status = status;
    }
    if (segment) {
      query.segment = segment;
    }
    
    // Get trades
    const trades = await Trade.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Trade.countDocuments(query);
    
    // Format trades
    const formattedTrades = trades.map(trade => ({
      id: trade._id,
      symbol: trade.symbol,
      segment: trade.segment,
      instrumentType: trade.instrumentType,
      exchange: trade.exchange,
      side: trade.side,
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      pnl: trade.pnl,
      status: trade.status,
      tradeDate: trade.tradeDate,
      tradeTime: trade.tradeTime,
      createdAt: trade.createdAt,
      updatedAt: trade.updatedAt
    }));
    
    res.json({
      trades: formattedTrades,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[TradingController] Error getting user trades:', error);
    res.status(500).json({ message: 'Failed to get trades' });
  }
};

// ==================== TRADING ANALYTICS ====================

/**
 * Get user trading statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserTradingStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const period = req.query.period || 'ALL'; // ALL, TODAY, WEEK, MONTH, YEAR
    
    // Get date range based on period
    const dateRange = getDateRange(period);
    
    // Build query
    let query = { user: userId };
    if (dateRange) {
      query.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }
    
    // Get trades for statistics
    const trades = await Trade.find(query);
    const positions = await Position.find({ user: userId, status: 'OPEN' });
    
    // Calculate statistics
    const stats = calculateTradingStats(trades, positions);
    
    res.json({
      stats,
      period,
      totalTrades: trades.length,
      openPositions: positions.length
    });
  } catch (error) {
    console.error('[TradingController] Error getting trading statistics:', error);
    res.status(500).json({ message: 'Failed to get trading statistics' });
  }
};

/**
 * Get user trading performance
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserTradingPerformance = async (req, res) => {
  try {
    const userId = req.user._id;
    const period = req.query.period || 'MONTH';
    
    // Get date range
    const dateRange = getDateRange(period);
    let query = { user: userId };
    if (dateRange) {
      query.createdAt = { $gte: dateRange.start, $lte: dateRange.end };
    }
    
    // Get trades
    const trades = await Trade.find(query).sort({ createdAt: 1 });
    
    // Calculate performance metrics
    const performance = calculatePerformanceMetrics(trades);
    
    res.json({
      performance,
      period,
      totalTrades: trades.length
    });
  } catch (error) {
    console.error('[TradingController] Error getting trading performance:', error);
    res.status(500).json({ message: 'Failed to get trading performance' });
  }
};

/**
 * Get user trading summary
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserTradingSummary = async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Get summary from TradeService
    const summary = await TradeService.getUserTradeSummary(userId);
    
    // Get current positions
    const openPositions = await Position.find({ user: userId, status: 'OPEN' });
    const totalOpenValue = openPositions.reduce((sum, pos) => {
      return sum + (pos.quantity * (pos.currentPrice || pos.entryPrice));
    }, 0);
    
    // Get user wallet
    const user = await User.findById(userId).select('wallet cryptoWallet forexWallet mcxWallet');
    
    res.json({
      summary: {
        ...summary,
        openPositions: openPositions.length,
        totalOpenValue,
        totalWalletBalance: (user.wallet || 0) + (user.cryptoWallet || 0) + (user.forexWallet || 0) + (user.mcxWallet || 0)
      }
    });
  } catch (error) {
    console.error('[TradingController] Error getting trading summary:', error);
    res.status(500).json({ message: 'Failed to get trading summary' });
  }
};

// ==================== POSITION MANAGEMENT ====================

/**
 * Close position
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const closePosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { exitPrice } = req.body;
    const userId = req.user._id;
    
    // Find position
    const position = await Position.findOne({ _id: id, user: userId, status: 'OPEN' });
    if (!position) {
      return res.status(404).json({ message: 'Position not found or already closed' });
    }
    
    // Close position using TradeService
    const closedPosition = await TradeService.closeTrade(position.trade, exitPrice, 'MANUAL');
    
    res.json({
      message: 'Position closed successfully',
      position: closedPosition
    });
  } catch (error) {
    console.error('[TradingController] Error closing position:', error);
    res.status(500).json({ message: 'Failed to close position' });
  }
};

/**
 * Get position details
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getPositionDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    // Find position
    const position = await Position.findOne({ _id: id, user: userId })
      .populate('trade', 'symbol segment instrumentType exchange entryPrice exitPrice pnl');
    
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }
    
    // Calculate P&L
    const pnl = calculatePositionPnL(position);
    
    res.json({
      position: {
        id: position._id,
        trade: position.trade,
        quantity: position.quantity,
        entryPrice: position.entryPrice,
        currentPrice: position.currentPrice,
        pnl: pnl,
        pnlPercent: position.entryPrice > 0 ? (pnl / (position.entryPrice * position.quantity)) * 100 : 0,
        status: position.status,
        segment: position.segment,
        instrumentType: position.instrumentType,
        exchange: position.exchange,
        createdAt: position.createdAt,
        updatedAt: position.updatedAt
      }
    });
  } catch (error) {
    console.error('[TradingController] Error getting position details:', error);
    res.status(500).json({ message: 'Failed to get position details' });
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Calculate position P&L
 * @param {Object} position - Position document
 * @returns {number} - P&L amount
 */
function calculatePositionPnL(position) {
  if (!position.currentPrice || position.status !== 'OPEN') {
    return position.pnl || 0;
  }
  
  const currentValue = position.quantity * position.currentPrice;
  const entryValue = position.quantity * position.entryPrice;
  
  if (position.side === 'BUY') {
    return currentValue - entryValue;
  } else {
    return entryValue - currentValue;
  }
}

/**
 * Calculate trading statistics
 * @param {Array} trades - Array of trade documents
 * @param {Array} positions - Array of position documents
 * @returns {Object} - Trading statistics
 */
function calculateTradingStats(trades, positions) {
  const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
  const winningTrades = closedTrades.filter(trade => (trade.pnl || 0) > 0);
  const losingTrades = closedTrades.filter(trade => (trade.pnl || 0) < 0);
  
  const totalPnL = closedTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
  const totalVolume = trades.reduce((sum, trade) => sum + (trade.quantity * trade.entryPrice), 0);
  const totalBrokerage = trades.reduce((sum, trade) => sum + (trade.brokerage || 0), 0);
  
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, trade) => sum + trade.pnl, 0) / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, trade) => sum + trade.pnl, 0) / losingTrades.length : 0;
  const profitFactor = avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : 0;
  
  // Calculate open positions P&L
  const openPnL = positions.reduce((sum, position) => sum + calculatePositionPnL(position), 0);
  
  return {
    totalTrades: trades.length,
    closedTrades: closedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate: Math.round(winRate * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    openPnL: Math.round(openPnL * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    totalBrokerage: Math.round(totalBrokerage * 100) / 100,
    avgWin: Math.round(avgWin * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0,
    maxLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0
  };
}

/**
 * Calculate performance metrics
 * @param {Array} trades - Array of trade documents
 * @returns {Object} - Performance metrics
 */
function calculatePerformanceMetrics(trades) {
  const closedTrades = trades.filter(trade => trade.status === 'CLOSED');
  
  // Calculate daily returns
  const dailyReturns = {};
  closedTrades.forEach(trade => {
    const date = trade.createdAt.toISOString().split('T')[0];
    if (!dailyReturns[date]) {
      dailyReturns[date] = 0;
    }
    dailyReturns[date] += trade.pnl || 0;
  });
  
  // Calculate running balance
  let runningBalance = 0;
  const balanceHistory = [];
  const dates = Object.keys(dailyReturns).sort();
  
  dates.forEach(date => {
    runningBalance += dailyReturns[date];
    balanceHistory.push({
      date,
      balance: runningBalance,
      dailyReturn: dailyReturns[date]
    });
  });
  
  // Calculate metrics
  const returns = balanceHistory.map(item => item.dailyReturn);
  const totalReturn = runningBalance;
  const avgDailyReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0;
  const volatility = calculateVolatility(returns);
  const sharpeRatio = volatility !== 0 ? avgDailyReturn / volatility : 0;
  
  // Calculate max drawdown
  let maxBalance = 0;
  let maxDrawdown = 0;
  balanceHistory.forEach(item => {
    if (item.balance > maxBalance) {
      maxBalance = item.balance;
    }
    const drawdown = maxBalance - item.balance;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  });
  
  return {
    totalReturn: Math.round(totalReturn * 100) / 100,
    avgDailyReturn: Math.round(avgDailyReturn * 100) / 100,
    volatility: Math.round(volatility * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    balanceHistory: balanceHistory.slice(-30) // Last 30 days
  };
}

/**
 * Calculate volatility
 * @param {Array} returns - Array of daily returns
 * @returns {number} - Volatility
 */
function calculateVolatility(returns) {
  if (returns.length < 2) return 0;
  
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / (returns.length - 1);
  
  return Math.sqrt(variance);
}

/**
 * Get date range based on period
 * @param {string} period - Period string
 * @returns {Object|null} - Date range object
 */
function getDateRange(period) {
  const now = new Date();
  let start, end;
  
  switch (period) {
    case 'TODAY':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'WEEK':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      end = now;
      break;
    case 'MONTH':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case 'YEAR':
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    default:
      return null;
  }
  
  return { start, end };
}
