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
   * Get the actual balance field name for a wallet type
   * @param {String} walletType - Wallet type
   * @returns {String} - Balance field name
   */
  static getBalanceFieldName(walletType) {
    switch(walletType) {
      case 'wallet':
        return 'wallet.cashBalance';
      case 'cryptoWallet':
        return 'cryptoWallet.balance';
      case 'forexWallet':
        return 'forexWallet.balance';
      case 'mcxWallet':
        return 'mcxWallet.balance';
      case 'gamesWallet':
        return 'gamesWallet.balance';
      default:
        return `${walletType}.balance`;
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

  /** Reverse of getWalletDisplayName — used to repair ledger rows missing meta.sourceWallet/targetWallet (legacy stripped meta). */
  static displayNameToWalletKey(displayName) {
    const k = String(displayName || '').trim();
    const map = {
      'Trading Wallet': 'wallet',
      'Crypto Wallet': 'cryptoWallet',
      'Forex Wallet': 'forexWallet',
      'MCX Wallet': 'mcxWallet',
      'Games Wallet': 'gamesWallet',
    };
    return map[k] || null;
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
    try {
      // Get current balances
      const freshUser = await User.findById(user._id);
      const sourceBalanceField = this.getBalanceFieldName(sourceWallet);
      const targetBalanceField = this.getBalanceFieldName(targetWallet);
      
      // Get actual balance values
      const currentSourceBalance = sourceBalanceField === 'wallet.cashBalance' 
        ? (freshUser.wallet?.cashBalance || 0)
        : (freshUser[sourceWallet]?.balance || 0);
      
      // Verify sufficient balance before transfer
      if (currentSourceBalance < amount) {
        throw new Error(`Insufficient balance in ${this.getWalletDisplayName(sourceWallet)}. Available: ₹${currentSourceBalance.toLocaleString()}`);
      }

      // Debit from source wallet and credit to target wallet in a single atomic operation
      const updates = {};
      updates[sourceBalanceField] = -amount;
      updates[targetBalanceField] = amount;
      
      // Only add depositTotal for non-main wallets
      if (targetWallet !== 'wallet') {
        updates[`${targetWallet}.depositTotal`] = amount;
      }

      const finalUser = await User.findByIdAndUpdate(
        user._id,
        { $inc: updates },
        { new: true }
      );

      if (!finalUser) {
        throw new Error('Failed to update wallet balances');
      }

      // Verify source wallet balance didn't go negative
      const newSourceBalance = sourceBalanceField === 'wallet.cashBalance'
        ? (finalUser.wallet?.cashBalance || 0)
        : (finalUser[sourceWallet]?.balance || 0);
      
      if (newSourceBalance < 0) {
        // Rollback by reversing the transaction
        const rollbackUpdates = {};
        rollbackUpdates[sourceBalanceField] = amount;
        rollbackUpdates[targetBalanceField] = -amount;
        if (targetWallet !== 'wallet') {
          rollbackUpdates[`${targetWallet}.depositTotal`] = -amount;
        }
        await User.findByIdAndUpdate(user._id, { $inc: rollbackUpdates });
        throw new Error('Insufficient balance after transfer');
      }

      // Create ledger entries (non-critical, can be retried if failed)
      try {
        await WalletLedger.create([
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: user.adminCode || 'SUPER',
            type: 'DEBIT',
            reason: 'WALLET_TRANSFER_DEBIT',
            amount: amount,
            balanceAfter: newSourceBalance,
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
            balanceAfter: targetBalanceField === 'wallet.cashBalance'
              ? (finalUser.wallet?.cashBalance || 0)
              : (finalUser[targetWallet]?.balance || 0),
            description: `Transfer from ${this.getWalletDisplayName(sourceWallet)}`,
            performedBy: performedBy,
            meta: {
              transferId,
              sourceWallet,
              targetWallet
            }
          }
        ]);
      } catch (ledgerError) {
        console.error('Failed to create ledger entries for wallet transfer:', ledgerError);
        // Don't throw error - ledger creation is non-critical
      }

      return {
        success: true,
        transferId,
        message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
        sourceBalance: newSourceBalance,
        targetBalance: targetBalanceField === 'wallet.cashBalance'
          ? (finalUser.wallet?.cashBalance || 0)
          : (finalUser[targetWallet]?.balance || 0)
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Execute transfer involving games wallet
   */
  static async executeGamesWalletTransfer(user, sourceWallet, targetWallet, amount, transferId, remarks, performedBy) {
    try {
      if (sourceWallet === 'gamesWallet') {
        // Debit from games wallet
        const gamesWalletDebit = await atomicGamesWalletDebit(User, user._id, amount);
        if (!gamesWalletDebit) {
          throw new Error('Insufficient balance in games wallet');
        }

        // Credit to target wallet
        const targetBalanceField = this.getBalanceFieldName(targetWallet);
        const targetUpdate = {};
        targetUpdate[targetBalanceField] = amount;
        
        // Only add depositTotal for non-main wallets
        if (targetWallet !== 'wallet') {
          targetUpdate[`${targetWallet}.depositTotal`] = amount;
        }

        const finalUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: targetUpdate },
          { new: true }
        );

        if (!finalUser) {
          throw new Error('Failed to credit target wallet');
        }

        // Create ledger entries (non-critical)
        try {
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
              balanceAfter: targetBalanceField === 'wallet.cashBalance'
                ? (finalUser.wallet?.cashBalance || 0)
                : (finalUser[targetWallet]?.balance || 0),
              description: `Transfer from ${this.getWalletDisplayName(sourceWallet)}`,
              performedBy: performedBy,
              meta: {
                transferId,
                sourceWallet,
                targetWallet
              }
            }
          ]);
        } catch (ledgerError) {
          console.error('Failed to create ledger entries for games wallet transfer:', ledgerError);
        }

        return {
          success: true,
          transferId,
          message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
          sourceBalance: gamesWalletDebit.balance,
          targetBalance: targetBalanceField === 'wallet.cashBalance'
            ? (finalUser.wallet?.cashBalance || 0)
            : (finalUser[targetWallet]?.balance || 0)
        };
      } else {
        // Get current source balance
        const freshUser = await User.findById(user._id);
        const sourceBalanceField = this.getBalanceFieldName(sourceWallet);
        
        const currentSourceBalance = sourceBalanceField === 'wallet.cashBalance'
          ? (freshUser.wallet?.cashBalance || 0)
          : (freshUser[sourceWallet]?.balance || 0);
        
        // Verify sufficient balance
        if (currentSourceBalance < amount) {
          throw new Error(`Insufficient balance in ${this.getWalletDisplayName(sourceWallet)}. Available: ₹${currentSourceBalance.toLocaleString()}`);
        }

        // Debit from source wallet
        const sourceUpdate = {};
        sourceUpdate[sourceBalanceField] = -amount;

        const updatedUser = await User.findByIdAndUpdate(
          user._id,
          { $inc: sourceUpdate },
          { new: true }
        );

        if (!updatedUser) {
          throw new Error('Failed to debit source wallet');
        }

        // Verify source wallet balance didn't go negative
        const newSourceBalance = sourceBalanceField === 'wallet.cashBalance'
          ? (updatedUser.wallet?.cashBalance || 0)
          : (updatedUser[sourceWallet]?.balance || 0);
          
        if (newSourceBalance < 0) {
          // Rollback
          const rollbackUpdates = {};
          rollbackUpdates[sourceBalanceField] = amount;
          await User.findByIdAndUpdate(user._id, { $inc: rollbackUpdates });
          throw new Error('Insufficient balance after transfer');
        }

        // Credit to games wallet
        await atomicGamesWalletUpdate(User, user._id, { balance: amount });

        const finalUser = await User.findById(user._id).select('gamesWallet').lean();

        // Create ledger entries (non-critical)
        try {
          await WalletLedger.create([
            {
              ownerType: 'USER',
              ownerId: user._id,
              adminCode: user.adminCode || 'SUPER',
              type: 'DEBIT',
              reason: 'WALLET_TRANSFER_DEBIT',
              amount: amount,
              balanceAfter: newSourceBalance,
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
          ]);
        } catch (ledgerError) {
          console.error('Failed to create ledger entries for games wallet transfer:', ledgerError);
        }

        return {
          success: true,
          transferId,
          message: `Successfully transferred ₹${amount.toLocaleString()} from ${this.getWalletDisplayName(sourceWallet)} to ${this.getWalletDisplayName(targetWallet)}`,
          sourceBalance: newSourceBalance,
          targetBalance: finalUser?.gamesWallet?.balance || 0
        };
      }
    } catch (error) {
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
      ownerType: 'USER',
      ownerId: userId,
      reason: { $in: ['WALLET_TRANSFER_DEBIT', 'WALLET_TRANSFER_CREDIT'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const parseTransferTo = (desc) => {
      const m = String(desc || '').match(/^Transfer to (.+)$/);
      if (!m) return null;
      return this.displayNameToWalletKey(m[1].trim());
    };
    const parseTransferFrom = (desc) => {
      const m = String(desc || '').match(/^Transfer from (.+)$/);
      if (!m) return null;
      return this.displayNameToWalletKey(m[1].trim());
    };

    // Group by meta.transferId (works when meta fields are persisted in schema)
    const grouped = {};
    const consumedIds = new Set();

    transfers.forEach((t) => {
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
            performedBy: t.performedBy,
          };
        }
        if (t._id) consumedIds.add(String(t._id));
      }
    });

    // Legacy: meta.transferId/sourceWallet/targetWallet were stripped by Mongoose strict schema —
    // pair DEBIT ("Transfer to Target") + CREDIT ("Transfer from Source") by amount & time window.
    const TIME_PAIR_MS = 15_000;
    const orphans = transfers.filter((t) => !consumedIds.has(String(t._id)));

    const amtEq = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;

    const debits = orphans.filter((t) => t.type === 'DEBIT');
    const credits = orphans.filter((t) => t.type === 'CREDIT');

    for (const d of debits) {
      const idStr = String(d._id);
      if (consumedIds.has(idStr)) continue;
      const targetKey = parseTransferTo.call(this, d.description);
      if (!targetKey) continue;

      let best = null;
      let bestDt = Infinity;
      for (const cred of credits) {
        if (consumedIds.has(String(cred._id))) continue;
        if (!amtEq(cred.amount, d.amount)) continue;
        const srcKey = parseTransferFrom.call(this, cred.description);
        if (!srcKey || srcKey === targetKey) continue;
        const dt = Math.abs(new Date(cred.createdAt).getTime() - new Date(d.createdAt).getTime());
        if (dt > TIME_PAIR_MS) continue;
        if (dt < bestDt) {
          bestDt = dt;
          best = cred;
        }
      }

      const c = best;
      if (!c) continue;

      const sourceKey = parseTransferFrom.call(this, c.description);
      const syntheticId = `WT-fallback-${idStr}-${c._id}`;
      grouped[syntheticId] = {
        transferId: syntheticId,
        createdAt: d.createdAt > c.createdAt ? d.createdAt : c.createdAt,
        amount: Number(d.amount),
        sourceWallet: sourceKey,
        targetWallet: targetKey,
        description: `${this.getWalletDisplayName(sourceKey)} → ${this.getWalletDisplayName(targetKey)}`,
        performedBy: d.performedBy || c.performedBy,
      };
      consumedIds.add(idStr);
      consumedIds.add(String(c._id));
    }

    return Object.values(grouped).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

export default WalletTransferService;
