import GameTransactionSlip from '../models/GameTransactionSlip.js';
import GameTransactionSlipEntry from '../models/GameTransactionSlipEntry.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import { getTodayISTString } from '../utils/istDate.js';

/**
 * Generate a unique transaction ID
 */
export function generateTransactionId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `TXN-${timestamp}-${random}`;
}

/**
 * Create a new transaction slip when user places bets
 */
export async function createTransactionSlip(userId, gameIds, totalDebitAmount, metadata = {}) {
  try {
    const user = await User.findById(userId).select('userCode adminCode username');
    if (!user) {
      throw new Error('User not found');
    }

    const transactionId = generateTransactionId();
    const sessionDate = getTodayISTString();
    const now = new Date();
    const placementTime = now.toLocaleTimeString('en-GB', { 
      timeZone: 'Asia/Kolkata', 
      hour12: false 
    });

    // Use userCode if available, otherwise fall back to username or userId
    const userCode = user.userCode || user.username || userId.toString();

    const slip = await GameTransactionSlip.create({
      transactionId,
      userId,
      userCode,
      adminCode: user.adminCode,
      gameIds: [...new Set(gameIds)], // Remove duplicates
      totalDebitAmount,
      metadata: {
        ...metadata,
        sessionDate,
        placementTime,
        totalBets: metadata.totalBets || gameIds.length,
        settledBets: 0
      }
    });

    return { slip, transactionId };
  } catch (error) {
    console.error('[TransactionSlip] Create failed:', error);
    throw error;
  }
}

/**
 * Add a debit entry when user places a bet
 */
export async function addDebitEntry(transactionSlipId, transactionId, gameId, amount, userId, userCode, betMetadata = {}) {
  try {
    const entry = await GameTransactionSlipEntry.create({
      transactionSlipId,
      transactionId,
      entryType: 'DEBIT',
      gameId,
      amount,
      recipientType: 'USER',
      recipientId: userId,
      recipientCode: userCode,
      description: `${getGameLabel(gameId)} - Bet placed (${betMetadata.prediction || 'N/A'})`,
      metadata: {
        ...betMetadata,
        gameLabel: getGameLabel(gameId),
        timestamp: new Date()
      }
    });

    return entry;
  } catch (error) {
    console.error('[TransactionSlip] Add debit entry failed:', error);
    throw error;
  }
}

/**
 * Add a credit entry when user wins
 */
export async function addCreditEntry(transactionSlipId, transactionId, gameId, amount, userId, userCode, winMetadata = {}) {
  try {
    const entry = await GameTransactionSlipEntry.create({
      transactionSlipId,
      transactionId,
      entryType: 'CREDIT',
      gameId,
      amount,
      recipientType: 'USER',
      recipientId: userId,
      recipientCode: userCode,
      description: `${getGameLabel(gameId)} - Winning credited (${winMetadata.won ? 'WIN' : 'LOSS'})`,
      metadata: {
        ...winMetadata,
        gameLabel: getGameLabel(gameId),
        timestamp: new Date()
      }
    });

    // Update transaction slip totals
    await updateTransactionSlipTotals(transactionSlipId);

    return entry;
  } catch (error) {
    console.error('[TransactionSlip] Add credit entry failed:', error);
    throw error;
  }
}

/**
 * Add brokerage distribution entries
 */
export async function addBrokerageDistributionEntries(transactionSlipId, transactionId, gameId, distributions, baseAmount, distributionType = 'WIN_BROKERAGE') {
  try {
    const entries = [];

    for (const [recipientType, amount] of Object.entries(distributions)) {
      if (amount <= 0) continue;

      // Find the recipient admin
      let recipientId, recipientCode;
      if (recipientType === 'USER') {
        // This shouldn't happen in brokerage distribution, but handle it
        continue;
      } else {
        const admin = await Admin.findOne({ 
          role: recipientType.replace('_', ' '), 
          status: 'ACTIVE' 
        }).select('_id adminCode');
        
        if (!admin) continue;
        
        recipientId = admin._id;
        recipientCode = admin.adminCode;
      }

      const entry = await GameTransactionSlipEntry.create({
        transactionSlipId,
        transactionId,
        entryType: 'BROKERAGE_DISTRIBUTION',
        gameId,
        amount,
        recipientType,
        recipientId,
        recipientCode,
        description: `${getGameLabel(gameId)} - Brokerage to ${recipientType.replace('_', ' ')}`,
        metadata: {
          baseAmount,
          distributionType,
          hierarchyLevel: recipientType,
          gameLabel: getGameLabel(gameId),
          timestamp: new Date()
        }
      });

      entries.push(entry);
    }

    return entries;
  } catch (error) {
    console.error('[TransactionSlip] Add brokerage entries failed:', error);
    throw error;
  }
}

/**
 * Update transaction slip totals and status
 */
export async function updateTransactionSlipTotals(transactionSlipId) {
  try {
    // Calculate totals from entries
    const creditEntries = await GameTransactionSlipEntry.find({
      transactionSlipId,
      entryType: 'CREDIT'
    });

    const totalCreditAmount = creditEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const settledBets = creditEntries.length;

    // Update the slip
    await GameTransactionSlip.findByIdAndUpdate(transactionSlipId, {
      totalCreditAmount,
      'metadata.settledBets': settledBets
    });

  } catch (error) {
    console.error('[TransactionSlip] Update totals failed:', error);
    throw error;
  }
}

/**
 * Get transaction slip with all entries
 */
export async function getTransactionSlipWithEntries(transactionSlipId) {
  try {
    const slip = await GameTransactionSlip.findById(transactionSlipId)
      .populate('userId', 'userCode name email')
      .lean();

    if (!slip) {
      throw new Error('Transaction slip not found');
    }

    const entries = await GameTransactionSlipEntry.find({ transactionSlipId })
      .sort({ createdAt: 1 })
      .lean();

    return { slip, entries };
  } catch (error) {
    console.error('[TransactionSlip] Get slip with entries failed:', error);
    throw error;
  }
}

/**
 * Find transaction slip by transaction ID
 */
export async function findTransactionSlipByTransactionId(transactionId) {
  try {
    return await GameTransactionSlip.findOne({ transactionId });
  } catch (error) {
    console.error('[TransactionSlip] Find by transaction ID failed:', error);
    throw error;
  }
}

/**
 * Get game label for display
 */
function getGameLabel(gameId) {
  const labels = {
    'updown': 'Nifty Up/Down',
    'btcupdown': 'BTC Up/Down',
    'niftyNumber': 'Nifty Number',
    'niftyBracket': 'Nifty Bracket',
    'niftyJackpot': 'Nifty Jackpot'
  };
  return labels[gameId] || gameId;
}

/**
 * Get transaction slips for Super Admin with filters
 */
export async function getTransactionSlipsForAdmin(filters = {}, page = 1, limit = 50) {
  try {
    const query = {};
    
    if (filters.userId) query.userId = filters.userId;
    if (filters.adminCode) query.adminCode = filters.adminCode;
    if (filters.status) query.status = filters.status;
    if (filters.gameId) query.gameIds = { $in: [filters.gameId] };
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    const skip = (page - 1) * limit;
    
    const [slips, total] = await Promise.all([
      GameTransactionSlip.find(query)
        .populate('userId', 'userCode name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GameTransactionSlip.countDocuments(query)
    ]);

    return {
      slips,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    };
  } catch (error) {
    console.error('[TransactionSlip] Get slips for admin failed:', error);
    throw error;
  }
}

/**
 * Get users under admin hierarchy
 */
async function getUsersUnderAdmin(adminId, adminRole) {
  const User = (await import('../models/User.js')).default;
  const Admin = (await import('../models/Admin.js')).default;
  
  if (adminRole === 'SUPER_ADMIN') {
    // Super Admin sees all users
    return await User.find({}).select('_id').lean();
  }
  
  // For other admin roles, get users under their hierarchy
  const admin = await Admin.findById(adminId).lean();
  if (!admin) return [];
  
  const query = { adminCode: admin.adminCode };
  
  if (adminRole === 'ADMIN') {
    // Admin sees users under their admin code
    return await User.find(query).select('_id').lean();
  } else if (adminRole === 'BROKER') {
    // Broker sees users under their broker hierarchy
    query.broker = adminId;
    return await User.find(query).select('_id').lean();
  } else if (adminRole === 'SUB_BROKER') {
    // SubBroker sees only their direct users
    query.subBroker = adminId;
    return await User.find(query).select('_id').lean();
  }
  
  return [];
}

/**
 * Find transaction slips for admin's users
 */
export async function findTransactionSlipsForAdmin(adminId, adminRole, options = {}) {
  try {
    const { skip = 0, limit = 20, status, gameId, dateFrom, dateTo, search } = options;
    
    // Get users under this admin's hierarchy
    const users = await getUsersUnderAdmin(adminId, adminRole);
    const userIds = users.map(u => u._id);
    
    if (userIds.length === 0) {
      return { slips: [], total: 0 };
    }
    
    const query = { userId: { $in: userIds } };
    
    if (status) query.status = status;
    if (gameId) query.gameIds = { $in: [gameId] };
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      query.$or = [
        { transactionId: { $regex: search, $options: 'i' } },
        { userCode: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [slips, total] = await Promise.all([
      GameTransactionSlip.find(query)
        .populate('userId', 'userCode name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GameTransactionSlip.countDocuments(query)
    ]);
    
    return { slips, total };
  } catch (error) {
    console.error('Error finding transaction slips for admin:', error);
    throw error;
  }
}

/**
 * Find transaction slip by ID for admin
 */
export async function findTransactionSlipByIdForAdmin(slipId, adminId, adminRole) {
  try {
    // Get users under this admin's hierarchy
    const users = await getUsersUnderAdmin(adminId, adminRole);
    const userIds = users.map(u => u._id);
    
    if (userIds.length === 0) {
      return null;
    }
    
    const slip = await GameTransactionSlip.findOne({
      _id: slipId,
      userId: { $in: userIds }
    })
    .populate('userId', 'userCode name email')
    .lean();
    
    if (!slip) return null;
    
    const entries = await GameTransactionSlipEntry.find({ transactionSlipId: slipId })
      .sort({ createdAt: 1 })
      .lean();
    
    return { slip, entries };
  } catch (error) {
    console.error('Error finding transaction slip by ID for admin:', error);
    throw error;
  }
}

/**
 * Get transaction slip statistics for admin
 */
export async function getTransactionSlipStatsForAdmin(adminId, adminRole) {
  try {
    // Get users under this admin's hierarchy
    const users = await getUsersUnderAdmin(adminId, adminRole);
    const userIds = users.map(u => u._id);
    
    if (userIds.length === 0) {
      return {
        totalSlips: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
        totalNetPnL: 0,
        statusBreakdown: {},
        gameBreakdown: {}
      };
    }
    
    const query = { userId: { $in: userIds } };
    
    const [
      totalSlips,
      aggregateStats,
      statusStats,
      gameStats
    ] = await Promise.all([
      GameTransactionSlip.countDocuments(query),
      GameTransactionSlip.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalDebitAmount: { $sum: '$totalDebitAmount' },
            totalCreditAmount: { $sum: '$totalCreditAmount' },
            totalNetPnL: { $sum: '$netPnL' }
          }
        }
      ]),
      GameTransactionSlip.aggregate([
        { $match: query },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      GameTransactionSlip.aggregate([
        { $match: query },
        { $unwind: '$gameIds' },
        { $group: { _id: '$gameIds', count: { $sum: 1 } } }
      ])
    ]);
    
    const stats = aggregateStats[0] || {
      totalDebitAmount: 0,
      totalCreditAmount: 0,
      totalNetPnL: 0
    };
    
    const statusBreakdown = {};
    statusStats.forEach(stat => {
      statusBreakdown[stat._id] = stat.count;
    });
    
    const gameBreakdown = {};
    gameStats.forEach(stat => {
      gameBreakdown[stat._id] = stat.count;
    });
    
    return {
      totalSlips,
      ...stats,
      statusBreakdown,
      gameBreakdown
    };
  } catch (error) {
    console.error('Error getting transaction slip stats for admin:', error);
    throw error;
  }
}

/**
 * Export transaction slips for admin
 */
export async function exportTransactionSlipsForAdmin(adminId, adminRole, filters = {}) {
  try {
    // Get users under this admin's hierarchy
    const users = await getUsersUnderAdmin(adminId, adminRole);
    const userIds = users.map(u => u._id);
    
    if (userIds.length === 0) {
      return 'Transaction ID,User Code,Games,Status,Total Debit,Total Credit,Net P&L,Created At,Updated At\n';
    }
    
    const query = { userId: { $in: userIds } };
    
    if (filters.status) query.status = filters.status;
    if (filters.gameId) query.gameIds = { $in: [filters.gameId] };
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }
    if (filters.search) {
      query.$or = [
        { transactionId: { $regex: filters.search, $options: 'i' } },
        { userCode: { $regex: filters.search, $options: 'i' } }
      ];
    }
    
    const slips = await GameTransactionSlip.find(query)
      .populate('userId', 'userCode name email')
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      'Transaction ID',
      'User Code',
      'Games',
      'Status',
      'Total Debit',
      'Total Credit',
      'Net P&L',
      'Created At',
      'Updated At'
    ];

    const rows = slips.map(slip => [
      slip.transactionId,
      slip.userCode,
      slip.gameIds.join(', '),
      slip.status,
      slip.totalDebitAmount.toFixed(2),
      slip.totalCreditAmount.toFixed(2),
      slip.netPnL.toFixed(2),
      new Date(slip.createdAt).toISOString(),
      new Date(slip.updatedAt).toISOString()
    ]);

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  } catch (error) {
    console.error('Error exporting transaction slips for admin:', error);
    throw error;
  }
}
