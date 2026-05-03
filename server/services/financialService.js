/**
 * Financial Service
 * 
 * Clean architecture implementation for financial business logic.
 * Handles wallet operations, deposits, withdrawals, transfers, and financial calculations.
 * 
 * Service Responsibilities:
 * 1. Financial transaction processing
 * 2. Wallet balance management
 * 3. Platform charge calculations
 * 4. Referral earnings calculations
 */

import User from '../models/User.js';
import Admin from '../models/Admin.js';
import BankAccount from '../models/BankAccount.js';
import BankSettings from '../models/BankSettings.js';
import FundRequest from '../models/FundRequest.js';
import WalletLedger from '../models/WalletLedger.js';
import GamesWalletLedger from '../models/GamesWalletLedger.js';
import WalletTransferService from '../services/walletTransferService.js';
import { buildUserPlatformChargeStatus } from '../services/platformChargeService.js';
import GameSettings from '../models/GameSettings.js';

// ==================== WALLET OPERATIONS ====================

/**
 * Get user wallet information with all wallet types
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Wallet information
 */
export const getUserWalletInfo = async (userId) => {
  const user = await User.findById(userId).select('wallet cryptoWallet forexWallet mcxWallet gamesWallet marginSettings rmsSettings');
  
  if (!user) {
    throw new Error('User not found');
  }

  let gamesTicketValue = 300;
  
  // Get games ticket value from settings
  try {
    const settings = await GameSettings.getSettings();
    if (settings?.games?.ticketValue) {
      gamesTicketValue = settings.games.ticketValue;
    }
  } catch (settingsError) {
    console.warn('[FinancialService] Could not fetch game settings for ticket value:', settingsError);
  }

  // Calculate games wallet ticket count
  const gamesTicketCount = user.gamesWallet ? Math.floor(user.gamesWallet / gamesTicketValue) : 0;

  return {
    wallet: user.wallet || 0,
    cryptoWallet: user.cryptoWallet || 0,
    forexWallet: user.forexWallet || 0,
    mcxWallet: user.mcxWallet || 0,
    gamesWallet: user.gamesWallet || 0,
    gamesTicketValue,
    gamesTicketCount,
    marginSettings: user.marginSettings || {},
    rmsSettings: user.rmsSettings || {}
  };
};

/**
 * Get platform charge status for user
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Platform charge status
 */
export const getPlatformChargeStatus = async (userId) => {
  const user = await User.findById(userId).select(
    'wallet createdAt isDemo isActive username userId'
  );
  
  if (!user) {
    throw new Error('User not found');
  }

  return buildUserPlatformChargeStatus(user);
};

// ==================== DEPOSIT/WITHDRAWAL PROCESSING ====================

/**
 * Process deposit request
 * @param {string} userId - User ID
 * @param {Object} depositData - Deposit request data
 * @returns {Promise<Object>} - Deposit request object
 */
export const processDepositRequest = async (userId, depositData) => {
  const { amount, utrNumber, paymentMethod, remarks } = depositData;

  // Validate deposit data
  await validateDepositRequest(depositData);

  // Create deposit request
  const depositRequest = await FundRequest.create({
    user: userId,
    type: 'DEPOSIT',
    amount,
    utrNumber,
    paymentMethod,
    remarks,
    status: 'PENDING',
    createdAt: new Date()
  });

  // Create wallet ledger entry
  await WalletLedger.create({
    ownerType: 'USER',
    ownerId: userId,
    type: 'DEPOSIT_REQUEST',
    amount,
    balance: await getUserBalance(userId, 'wallet'),
    description: `Deposit request - ${utrNumber}`,
    referenceId: depositRequest._id,
    createdAt: new Date()
  });

  return {
    id: depositRequest._id,
    amount,
    status: 'PENDING',
    createdAt: depositRequest.createdAt
  };
};

/**
 * Process withdrawal request
 * @param {string} userId - User ID
 * @param {Object} withdrawData - Withdrawal request data
 * @returns {Promise<Object>} - Withdrawal request object
 */
export const processWithdrawRequest = async (userId, withdrawData) => {
  const { amount, accountDetails, paymentMethod, remarks } = withdrawData;

  // Validate withdrawal data
  await validateWithdrawRequest(withdrawData);

  // Check if user has sufficient balance
  const userBalance = await getUserBalance(userId, 'wallet');
  if (userBalance < amount) {
    throw new Error('Insufficient balance');
  }

  // Create withdrawal request
  const withdrawRequest = await FundRequest.create({
    user: userId,
    type: 'WITHDRAW',
    amount,
    accountDetails,
    paymentMethod,
    remarks,
    status: 'PENDING',
    createdAt: new Date()
  });

  // Create wallet ledger entry
  await WalletLedger.create({
    ownerType: 'USER',
    ownerId: userId,
    type: 'WITHDRAW_REQUEST',
    amount: -amount,
    balance: userBalance,
    description: `Withdrawal request`,
    referenceId: withdrawRequest._id,
    createdAt: new Date()
  });

  return {
    id: withdrawRequest._id,
    amount,
    status: 'PENDING',
    createdAt: withdrawRequest.createdAt
  };
};

/**
 * Process wallet transfer
 * @param {string} userId - User ID
 * @param {Object} transferData - Transfer data
 * @returns {Promise<Object>} - Transfer result
 */
export const processWalletTransfer = async (userId, transferData) => {
  const { sourceWallet, targetWallet, amount, remarks } = transferData;

  // Validate transfer data
  await validateWalletTransfer(transferData);

  const result = await WalletTransferService.transferBetweenWallets(
    userId,
    sourceWallet,
    targetWallet,
    amount,
    remarks
  );

  if (!result.success) {
    throw new Error(result.message);
  }

  return {
    sourceWallet,
    targetWallet,
    amount,
    newBalances: result.newBalances,
    transactionId: result.transactionId
  };
};

/**
 * Get wallet transfer history
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Transfer history
 */
export const getWalletTransferHistory = async (userId) => {
  return await WalletTransferService.getTransferHistory(userId);
};

// ==================== REFERRAL EARNINGS ====================

/**
 * Calculate referral earnings for user
 * @param {string} userId - User ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} - Referral earnings data
 */
export const calculateReferralEarnings = async (userId, options = {}) => {
  const { limit = 200, gameId = '', date = '' } = options;
  
  // Get referral records
  const Referral = (await import('../models/Referral.js')).default;
  const referrals = await Referral.find({ referrer: userId })
    .populate('referredUser', 'username fullName email createdAt')
    .sort({ createdAt: -1 })
    .limit(limit);

  // Build ledger query
  let walletQuery = {
    ownerType: 'USER',
    ownerId: userId,
    type: 'CREDIT',
    description: { $regex: /referral/i }
  };
  
  let gamesQuery = {
    ownerType: 'USER',
    ownerId: userId,
    type: 'CREDIT',
    description: { $regex: /referral/i }
  };

  // Add game filter if specified
  if (gameId) {
    walletQuery.description = { $regex: new RegExp(`${gameId}|referral`, 'i') };
    gamesQuery.description = { $regex: new RegExp(`${gameId}|referral`, 'i') };
  }

  // Add date filter if specified
  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    
    walletQuery.createdAt = { $gte: dayStart, $lte: dayEnd };
    gamesQuery.createdAt = { $gte: dayStart, $lte: dayEnd };
  }

  // Get ledger entries
  const [walletEntries, gamesEntries] = await Promise.all([
    WalletLedger.find(walletQuery).sort({ createdAt: -1 }).limit(limit),
    GamesWalletLedger.find(gamesQuery).sort({ createdAt: -1 }).limit(limit)
  ]);

  // Combine and format earnings
  const referralAmounts = [
    ...walletEntries.map(entry => ({
      id: entry._id,
      type: 'wallet',
      amount: entry.amount,
      description: entry.description,
      createdAt: entry.createdAt,
      balance: entry.balance
    })),
    ...gamesEntries.map(entry => ({
      id: entry._id,
      type: 'games',
      amount: entry.amount,
      description: entry.description,
      createdAt: entry.createdAt,
      balance: entry.balance
    }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  const totalEarnings = referralAmounts.reduce((sum, item) => sum + item.amount, 0);

  return {
    referralAmounts,
    totalEarnings,
    totalReferrals: referrals.length,
    referrals: referrals.map(ref => ({
      id: ref._id,
      referredUser: ref.referredUser,
      status: ref.status,
      createdAt: ref.createdAt,
      activatedAt: ref.activatedAt,
      firstTradingWin: ref.firstTradingWin ? {
        amount: ref.firstTradingWin.amount || 0,
        creditedAt: ref.firstTradingWin.creditedAt
      } : null
    }))
  };
};

// ==================== BANK DETAILS ====================

/**
 * Get bank details for deposits
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Bank details
 */
export const getBankDetails = async (userId) => {
  // Get user's admin code
  const user = await User.findById(userId).select('adminCode');
  if (!user) {
    throw new Error('User not found');
  }

  // Get admin's bank accounts
  const admin = await Admin.findOne({ adminCode: user.adminCode })
    .populate('bankAccounts');
  
  if (!admin) {
    throw new Error('Admin not found');
  }

  // Get bank settings
  const bankSettings = await BankSettings.findOne().sort({ createdAt: -1 });
  
  return {
    adminName: admin.name,
    adminCode: admin.adminCode,
    bankAccounts: admin.bankAccounts || [],
    bankSettings: bankSettings || {},
    instructions: bankSettings?.depositInstructions || 'Please contact your admin for deposit instructions'
  };
};

// ==================== VALIDATION FUNCTIONS ====================

/**
 * Validate deposit request data
 * @param {Object} depositData - Deposit request data
 * @returns {Promise<void>}
 */
export const validateDepositRequest = async (depositData) => {
  const { amount, utrNumber, paymentMethod } = depositData;

  if (!amount || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  const validPaymentMethods = ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    throw new Error('Invalid payment method. Valid methods: ' + validPaymentMethods.join(', '));
  }

  if (paymentMethod === 'BANK_TRANSFER' && !utrNumber) {
    throw new Error('UTR number is required for bank transfers');
  }
};

/**
 * Validate withdrawal request data
 * @param {Object} withdrawData - Withdrawal request data
 * @returns {Promise<void>}
 */
export const validateWithdrawRequest = async (withdrawData) => {
  const { amount, accountDetails, paymentMethod } = withdrawData;

  if (!amount || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  const validPaymentMethods = ['BANK_TRANSFER', 'UPI', 'CASH', 'CHEQUE'];
  if (!validPaymentMethods.includes(paymentMethod)) {
    throw new Error('Invalid payment method. Valid methods: ' + validPaymentMethods.join(', '));
  }

  if (!accountDetails) {
    throw new Error('Account details are required');
  }
};

/**
 * Validate wallet transfer data
 * @param {Object} transferData - Transfer data
 * @returns {Promise<void>}
 */
export const validateWalletTransfer = async (transferData) => {
  const { sourceWallet, targetWallet, amount } = transferData;

  if (!sourceWallet || !targetWallet || !amount) {
    throw new Error('Source wallet, target wallet, and amount are required');
  }

  if (typeof amount !== 'number' || amount <= 0) {
    throw new Error('Amount must be a positive number');
  }

  const validWallets = ['wallet', 'cryptoWallet', 'forexWallet', 'mcxWallet', 'gamesWallet'];
  if (!validWallets.includes(sourceWallet) || !validWallets.includes(targetWallet)) {
    throw new Error('Invalid wallet type. Valid types: ' + validWallets.join(', '));
  }

  if (sourceWallet === targetWallet) {
    throw new Error('Source and target wallets must be different');
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get user balance for specific wallet type
 * @param {string} userId - User ID
 * @param {string} walletType - Wallet type
 * @returns {Promise<number>} - Wallet balance
 */
export const getUserBalance = async (userId, walletType) => {
  const user = await User.findById(userId).select(walletType);
  return user?.[walletType] || 0;
};

/**
 * Calculate platform charges
 * @param {string} userId - User ID
 * @param {number} amount - Amount to charge
 * @param {string} chargeType - Type of charge
 * @returns {Promise<number>} - Calculated charge amount
 */
export const calculatePlatformCharges = async (userId, amount, chargeType) => {
  // This would integrate with the platform charge service
  // For now, return a basic calculation
  const chargeRate = 0.001; // 0.1%
  return Math.round(amount * chargeRate * 100) / 100;
};

/**
 * Update user wallet balance
 * @param {string} userId - User ID
 * @param {string} walletType - Wallet type
 * @param {number} amount - Amount to add/subtract
 * @param {string} description - Transaction description
 * @returns {Promise<void>}
 */
export const updateUserWalletBalance = async (userId, walletType, amount, description) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  const currentBalance = user[walletType] || 0;
  const newBalance = currentBalance + amount;

  if (newBalance < 0) {
    throw new Error('Insufficient balance');
  }

  user[walletType] = newBalance;
  await user.save();

  // Create ledger entry
  await WalletLedger.create({
    ownerType: 'USER',
    ownerId: userId,
    type: amount > 0 ? 'CREDIT' : 'DEBIT',
    amount: Math.abs(amount),
    balance: newBalance,
    description,
    createdAt: new Date()
  });
};
