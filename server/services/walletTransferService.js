import User from '../models/User.js';
import WalletLedger from '../models/WalletLedger.js';
import { atomicGamesWalletUpdate, atomicGamesWalletDebit } from '../utils/gamesWallet.js';

/**
 * Wallet Transfer Service
 * Handles interconnected wallet-to-wallet transfers for users
 * Supported wallets: wallet, cryptoWallet, forexWallet, mcxWallet, gamesWallet
 */
class WalletTransferService {
  
  /**
   * Get wallet balance for a specific wallet type
   * @param {Object} user - User document
   * @param {String} walletType - Wallet type (wallet, cryptoWallet, forexWallet, mcxWallet, gamesWallet)
   * @returns {Number} - Available balance (free balance considering used margin)
   */
  static getWalletBalance(user, walletType) {
    switch(walletType) {
      case 'wallet':
        return user.wallet?.cashBalance || 0;
      case 'cryptoWallet':
        return (user.cryptoWallet?.balance || 0) - (user.cryptoWallet?.usedMargin || 0);
      case 'forexWallet':
        return (user.forexWallet?.balance || 0) - (user.forexWallet?.usedMargin || 0);
      case 'mcxWallet':
        return (user.mcxWallet?.balance || 0) - (user.mcxWallet?.usedMargin || 0);
      case 'gamesWallet':
        return (user.gamesWallet?.balance || 0) - (user.gamesWallet?.usedMargin || 0);
      default:
        return 0;
    }
  }

  /**
   * Validate wallet transfer request
   * @param {Object} user - User document
   * @param {String} sourceWallet - Source wallet type
   * @param {String} targetWallet - Target wallet type
   * @param {Number} amount - Transfer amount
   * @returns {Object} - { valid: boolean, error: string }
   */
  static validateTransfer(user, sourceWallet, targetWallet, amount) {
    // Check if source and target wallets are different
    if (sourceWallet === targetWallet) {
      return { valid: false, error: 'Source and target wallets cannot be the same' };
    }

    // Check if wallet types are valid
    const validWallets = ['wallet', 'cryptoWallet', 'forexWallet', 'mcxWallet', 'gamesWallet'];
    if (!validWallets.includes(sourceWallet)) {
      return { valid: false, error: 'Invalid source wallet type' };
    }
    if (!validWallets.includes(targetWallet)) {
      return { valid: false, error: 'Invalid target wallet type' };
    }

    // Check if amount is valid
    if (!amount || amount <= 0) {
      return { valid: false, error: 'Transfer amount must be greater than 0' };
    }

    // Check if source wallet has sufficient balance
    const sourceBalance = this.getWalletBalance(user, sourceWallet);
    if (sourceBalance < amount) {
      return { valid: false, error: `Insufficient balance in ${this.getWalletDisplayName(sourceWallet)}. Available: ₹${sourceBalance.toLocaleString()}` };
    }

    return { valid: true };
  }

  /**
   * Get display name for wallet type
   * @param {String} walletType - Wallet type
   * @returns {String} - Display name
   */
  static getWalletDisplayName(walletType) {
    switch(walletType) {
      case 'wallet': return 'Trading Wallet';
      case 'cryptoWallet': return 'Crypto Wallet';
      case 'forexWallet': return 'Forex Wallet';
      case 'mcxWallet': return 'MCX Wallet';
      case 'gamesWallet': return 'Games Wallet';
      default: return walletType;
    }
  }

  /**
   * Execute wallet transfer (atomic operation)
   * @param {String} userId - User ID
   * @param {String} sourceWallet - Source wallet type
   * @param {String} targetWallet - Target wallet type
   * @param {Number} amount - Transfer amount
   * @param {String} remarks - Transfer remarks
   * @param {String} performedBy - Admin ID who performed the transfer
   * @returns {Object} - Transfer result
   */
  static async executeTransfer(userId, sourceWallet, targetWallet, amount, remarks = '', performedBy = null) {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Validate transfer
    const validation = this.validateTransfer(user, sourceWallet, targetWallet, amount);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const transferId = `WT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Execute transfer based on wallet types
    if (sourceWallet === 'gamesWallet' || targetWallet === 'gamesWallet') {
      return await this.executeGamesWalletTransfer(user, sourceWallet, targetWallet, amount, transferId, remarks, performedBy);
    } else {
      return await this.executeStandardWalletTransfer(user, sourceWallet, targetWallet, amount, transferId, remarks, performedBy);
    }
  }

  /**
   * Execute standard wallet transfer (wallet, cryptoWallet, forexWallet, mcxWallet)
   */
  static async executeStandardWalletTransfer(user, sourceWallet, targetWallet, amount, transferId, remarks, performedBy) {
    const session = await User.startSession();
    session.startTransaction();

    try {
      // Debit from source wallet
      const sourceUpdate = {};
      sourceUpdate[`${sourceWallet}.balance`] = -amount;
      
      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: sourceUpdate },
        { session, new: true }
      );

      if (!updatedUser) {
        throw new Error('Failed to debit source wallet');
      }

      // Verify source wallet has sufficient balance after debit
      const newSourceBalance = updatedUser[sourceWallet]?.balance || 0;
      if (newSourceBalance < 0) {
        throw new Error('Insufficient balance after debit');
      }

      // Credit to target wallet
      const targetUpdate = {};
      targetUpdate[`${targetWallet}.balance`] = amount;
      targetUpdate[`${targetWallet}.depositTotal`] = amount;

      const finalUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: targetUpdate },
        { session, new: true }
      );

      if (!finalUser) {
        throw new Error('Failed to credit target wallet');
      }

      // Create ledger entries
      await WalletLedger.create([
        {
          ownerType: 'USER',
          ownerId: user._id,
          adminCode: user.adminCode || 'SUPER',
          type: 'DEBIT',
          reason: 'WALLET_TRANSFER_DEBIT',
          amount: amount,
          balanceAfter: finalUser[sourceWallet]?.balance || 0,
          description: `Transfer to ${this.getWalletDisplayName(targetWallet)}`,
          performedBy: performedBy,
          meta: {
            transferId,
            sourceWallet,
            targetWallet
          }
        },
        {
          ownerType: 'USER',
          ownerId: user._id,
          adminCode: user.adminCode || 'SUPER',
          type: 'CREDIT',
          reason: 'WALLET_TRANSFER_CREDIT',
          amount: amount,
          balanceAfter: finalUser[targetWallet]?.balance || 0,
          description: `Transfer from ${this.getWalletDisplayName(sourceWallet)}`,
          performedBy: performedBy,
          meta: {
            transferId,
            sourceWallet,
            targetWallet
          }
        }
      ], { session });

      await session.commitTransaction();
      session.endSession();

      return {
        success: true,
        transferId,
        message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
        sourceBalance: finalUser[sourceWallet]?.balance || 0,
        targetBalance: finalUser[targetWallet]?.balance || 0
      };
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Execute transfer involving games wallet
   */
  static async executeGamesWalletTransfer(user, sourceWallet, targetWallet, amount, transferId, remarks, performedBy) {
    const session = await User.startSession();
    session.startTransaction();

    try {
      if (sourceWallet === 'gamesWallet') {
        // Debit from games wallet
        const gamesWalletDebit = await atomicGamesWalletDebit(User, user._id, amount);
        if (!gamesWalletDebit) {
          throw new Error('Insufficient balance in games wallet');
        }

        // Credit to target wallet
        const targetUpdate = {};
        targetUpdate[`${targetWallet}.balance`] = amount;
        targetUpdate[`${targetWallet}.depositTotal`] = amount;

        const finalUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: targetUpdate },
          { session, new: true }
        );

        // Create ledger entries
        await WalletLedger.create([
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: user.adminCode || 'SUPER',
            type: 'DEBIT',
            reason: 'WALLET_TRANSFER_DEBIT',
            amount: amount,
            balanceAfter: gamesWalletDebit.balance,
            description: `Transfer to ${this.getWalletDisplayName(targetWallet)}`,
            performedBy: performedBy,
            meta: {
              transferId,
              sourceWallet,
              targetWallet
            }
          },
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: user.adminCode || 'SUPER',
            type: 'CREDIT',
            reason: 'WALLET_TRANSFER_CREDIT',
            amount: amount,
            balanceAfter: finalUser[targetWallet]?.balance || 0,
            description: `Transfer from ${this.getWalletDisplayName(sourceWallet)}`,
            performedBy: performedBy,
            meta: {
              transferId,
              sourceWallet,
              targetWallet
            }
          }
        ], { session });

        await session.commitTransaction();
        session.endSession();

        return {
          success: true,
          transferId,
          message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
          sourceBalance: gamesWalletDebit.balance,
          targetBalance: finalUser[targetWallet]?.balance || 0
        };
      } else {
        // Debit from source wallet
        const sourceUpdate = {};
        sourceUpdate[`${sourceWallet}.balance`] = -amount;

        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: sourceUpdate },
          { session, new: true }
        );

        if (!updatedUser) {
          throw new Error('Failed to debit source wallet');
        }

        // Credit to games wallet
        await atomicGamesWalletUpdate(User, user._id, { balance: amount });

        const finalUser = await User.findById(user._id).select('gamesWallet').lean();

        // Create ledger entries
        await WalletLedger.create([
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: user.adminCode || 'SUPER',
            type: 'DEBIT',
            reason: 'WALLET_TRANSFER_DEBIT',
            amount: amount,
            balanceAfter: updatedUser[sourceWallet]?.balance || 0,
            description: `Transfer to ${this.getWalletDisplayName(targetWallet)}`,
            performedBy: performedBy,
            meta: {
              transferId,
              sourceWallet,
              targetWallet
            }
          },
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: user.adminCode || 'SUPER',
            type: 'CREDIT',
            reason: 'WALLET_TRANSFER_CREDIT',
            amount: amount,
            balanceAfter: finalUser?.gamesWallet?.balance || 0,
            description: `Transfer from ${this.getWalletDisplayName(sourceWallet)}`,
            performedBy: performedBy,
            meta: {
              transferId,
              sourceWallet,
              targetWallet
            }
          }
        ], { session });

        await session.commitTransaction();
        session.endSession();

        return {
          success: true,
          transferId,
          message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
          sourceBalance: updatedUser[sourceWallet]?.balance || 0,
          targetBalance: finalUser?.gamesWallet?.balance || 0
        };
      }
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  }

  /**
   * Get transfer history for a user
   * @param {String} userId - User ID
   * @returns {Array} - Transfer history
   */
  static async getTransferHistory(userId) {
    const transfers = await WalletLedger.find({
      ownerId: userId,
      reason: { $in: ['WALLET_TRANSFER_DEBIT', 'WALLET_TRANSFER_CREDIT'] }
    }).sort({ createdAt: -1 });

    // Group by transferId
    const grouped = {};
    transfers.forEach(t => {
      const transferId = t.meta?.transferId;
      if (transferId) {
        if (!grouped[transferId]) {
          grouped[transferId] = {
            transferId,
            createdAt: t.createdAt,
            amount: t.amount,
            sourceWallet: t.meta?.sourceWallet,
            targetWallet: t.meta?.targetWallet,
            description: t.description,
            performedBy: t.performedBy
          };
        }
      }
    });

    return Object.values(grouped);
  }
}

export default WalletTransferService;
