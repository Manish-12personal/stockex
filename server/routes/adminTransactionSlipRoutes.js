import express from 'express';
import { protectAdmin } from '../middleware/auth.js';
import { 
  getTransactionSlipsForAdmin, 
  getTransactionSlipWithEntries 
} from '../services/gameTransactionSlipService.js';
import GameTransactionSlip from '../models/GameTransactionSlip.js';
import GameTransactionSlipEntry from '../models/GameTransactionSlipEntry.js';

const router = express.Router();

// Get all transaction slips with filters (Super Admin only)
router.get('/transaction-slips', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can view all transaction slips
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const {
      page = 1,
      limit = 50,
      userId,
      adminCode,
      status,
      gameId,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const filters = {};
    if (userId) filters.userId = userId;
    if (adminCode) filters.adminCode = adminCode;
    if (status) filters.status = status;
    if (gameId) filters.gameId = gameId;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filters.$or = [
        { transactionId: searchRegex },
        { userCode: searchRegex },
        { adminCode: searchRegex }
      ];
    }

    const result = await getTransactionSlipsForAdmin(
      filters, 
      parseInt(page), 
      parseInt(limit)
    );

    res.json(result);
  } catch (error) {
    console.error('Get transaction slips error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get detailed transaction slip with all entries
router.get('/transaction-slip/:id', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can view transaction slip details
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const { id } = req.params;
    const result = await getTransactionSlipWithEntries(id);

    if (!result.slip) {
      return res.status(404).json({ message: 'Transaction slip not found' });
    }

    res.json(result);
  } catch (error) {
    console.error('Get transaction slip details error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get transaction slip statistics
router.get('/transaction-slip-stats', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can view statistics
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const { dateFrom, dateTo } = req.query;
    
    const matchStage = {};
    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
    }

    const stats = await GameTransactionSlip.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalSlips: { $sum: 1 },
          totalDebitAmount: { $sum: '$totalDebitAmount' },
          totalCreditAmount: { $sum: '$totalCreditAmount' },
          totalNetPnL: { $sum: '$netPnL' },
          pendingSlips: {
            $sum: { $cond: [{ $eq: ['$status', 'PENDING'] }, 1, 0] }
          },
          partiallySettledSlips: {
            $sum: { $cond: [{ $eq: ['$status', 'PARTIALLY_SETTLED'] }, 1, 0] }
          },
          fullySettledSlips: {
            $sum: { $cond: [{ $eq: ['$status', 'FULLY_SETTLED'] }, 1, 0] }
          }
        }
      }
    ]);

    const gameStats = await GameTransactionSlip.aggregate([
      { $match: matchStage },
      { $unwind: '$gameIds' },
      {
        $group: {
          _id: '$gameIds',
          count: { $sum: 1 },
          totalDebit: { $sum: '$totalDebitAmount' },
          totalCredit: { $sum: '$totalCreditAmount' },
          netPnL: { $sum: '$netPnL' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const brokerageStats = await GameTransactionSlipEntry.aggregate([
      { $match: { entryType: 'BROKERAGE_DISTRIBUTION', ...matchStage } },
      {
        $group: {
          _id: '$recipientType',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { totalAmount: -1 } }
    ]);

    res.json({
      overall: stats[0] || {
        totalSlips: 0,
        totalDebitAmount: 0,
        totalCreditAmount: 0,
        totalNetPnL: 0,
        pendingSlips: 0,
        partiallySettledSlips: 0,
        fullySettledSlips: 0
      },
      byGame: gameStats,
      brokerageDistribution: brokerageStats
    });
  } catch (error) {
    console.error('Get transaction slip stats error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Export transaction slips to CSV
router.get('/transaction-slips/export', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can export
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Access denied. Super Admin only.' });
    }

    const { dateFrom, dateTo, status, gameId } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (gameId) filters.gameIds = { $in: [gameId] };
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    const slips = await GameTransactionSlip.find(filters)
      .populate('userId', 'userCode name email')
      .sort({ createdAt: -1 })
      .limit(10000) // Limit for performance
      .lean();

    // Convert to CSV format
    const csvHeader = 'Transaction ID,User Code,User Name,Admin Code,Games,Total Debit,Total Credit,Net P&L,Status,Created At,Settled At\n';
    
    const csvRows = slips.map(slip => {
      const games = slip.gameIds.join(';');
      const createdAt = new Date(slip.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const settledAt = slip.settledAt ? new Date(slip.settledAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '';
      
      return [
        slip.transactionId,
        slip.userCode,
        slip.userId?.name || '',
        slip.adminCode,
        games,
        slip.totalDebitAmount.toFixed(2),
        slip.totalCreditAmount.toFixed(2),
        slip.netPnL.toFixed(2),
        slip.status,
        createdAt,
        settledAt
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(',');
    });

    const csv = csvHeader + csvRows.join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transaction-slips.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Export transaction slips error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
