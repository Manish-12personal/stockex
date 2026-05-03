/**
 * Referral Test Cleanup Service
 * 
 * Handles cleanup of test data and restoration of original state.
 * Follows SOLID principles with single responsibility for cleanup operations.
 */

export class ReferralTestCleanupService {
  constructor(userRepository, adminRepository, referralRepository, walletLedgerRepository, superAdminEarningsRepository) {
    this.userRepository = userRepository;
    this.adminRepository = adminRepository;
    this.referralRepository = referralRepository;
    this.walletLedgerRepository = walletLedgerRepository;
    this.superAdminEarningsRepository = superAdminEarningsRepository;
  }

  async cleanup(setupResult) {
    try {
      console.log('[CleanupService] Starting test cleanup...');
      
      if (!setupResult) {
        console.log('[CleanupService] No setup result provided, skipping cleanup');
        return;
      }

      const { users, hierarchy, startTime } = setupResult;
      
      // Clean up in reverse order of creation
      await this.cleanupWalletLedger(startTime);
      await this.cleanupSuperAdminEarnings(startTime);
      await this.cleanupReferralRecords(users);
      await this.cleanupUsers(users);
      await this.cleanupAdmins(hierarchy);
      
      console.log('[CleanupService] Test cleanup completed successfully');
      
    } catch (error) {
      console.error('[CleanupService] Error during cleanup:', error);
      // Continue cleanup even if some steps fail
    }
  }

  async cleanupUsers(users) {
    try {
      if (!users || Object.keys(users).length === 0) {
        console.log('[CleanupService] No users to clean up');
        return;
      }

      console.log(`[CleanupService] Cleaning up ${Object.keys(users).length} test users...`);
      
      const userIds = Object.values(users).map(user => user._id);
      
      // Delete referral records first (foreign key constraint)
      await this.referralRepository.deleteMany({ 
        $or: [
          { referredUser: { $in: userIds } },
          { referralClient: { $in: userIds } }
        ]
      });
      
      // Delete users
      const deleteResult = await this.userRepository.deleteMany({ _id: { $in: userIds } });
      
      console.log(`[CleanupService] Deleted ${deleteResult.deletedCount} users`);
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up users:', error);
    }
  }

  async cleanupAdmins(hierarchy) {
    try {
      if (!hierarchy || Object.keys(hierarchy).length === 0) {
        console.log('[CleanupService] No admins to clean up');
        return;
      }

      console.log(`[CleanupService] Cleaning up ${Object.keys(hierarchy).length} test admins...`);
      
      const adminIds = Object.values(hierarchy).map(admin => admin._id);
      
      // Delete admins
      const deleteResult = await this.adminRepository.deleteMany({ _id: { $in: adminIds } });
      
      console.log(`[CleanupService] Deleted ${deleteResult.deletedCount} admins`);
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up admins:', error);
    }
  }

  async cleanupReferralRecords(users) {
    try {
      if (!users || Object.keys(users).length === 0) {
        console.log('[CleanupService] No referral records to clean up');
        return;
      }

      console.log('[CleanupService] Cleaning up referral records...');
      
      const userIds = Object.values(users).map(user => user._id);
      
      // Delete referral records
      const deleteResult = await this.referralRepository.deleteMany({ 
        $or: [
          { referredUser: { $in: userIds } },
          { referralClient: { $in: userIds } }
        ]
      });
      
      console.log(`[CleanupService] Deleted ${deleteResult.deletedCount} referral records`);
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up referral records:', error);
    }
  }

  async cleanupWalletLedger(startTime) {
    try {
      if (!startTime) {
        console.log('[CleanupService] No start time provided for wallet ledger cleanup');
        return;
      }

      console.log('[CleanupService] Cleaning up wallet ledger entries...');
      
      // Delete ledger entries created during test
      const deleteResult = await this.walletLedgerRepository.deleteMany({
        createdAt: { $gte: startTime }
      });
      
      console.log(`[CleanupService] Deleted ${deleteResult.deletedCount} wallet ledger entries`);
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up wallet ledger:', error);
    }
  }

  async cleanupSuperAdminEarnings(startTime) {
    try {
      if (!startTime) {
        console.log('[CleanupService] No start time provided for SuperAdmin earnings cleanup');
        return;
      }

      console.log('[CleanupService] Cleaning up SuperAdmin earnings...');
      
      // Delete earnings records created during test
      const deleteResult = await this.superAdminEarningsRepository.deleteMany({
        createdAt: { $gte: startTime }
      });
      
      console.log(`[CleanupService] Deleted ${deleteResult.deletedCount} SuperAdmin earnings records`);
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up SuperAdmin earnings:', error);
    }
  }

  async cleanupGameTransactionSlips(startTime) {
    try {
      if (!startTime) {
        console.log('[CleanupService] No start time provided for game transaction slips cleanup');
        return;
      }

      console.log('[CleanupService] Cleaning up game transaction slips...');
      
      // Note: This would require importing GameTransactionSlip model
      // For now, just log the intention
      console.log('[CleanupService] Game transaction slips cleanup would be implemented here');
      
    } catch (error) {
      console.error('[CleanupService] Error cleaning up game transaction slips:', error);
    }
  }

  async restoreOriginalSettings() {
    try {
      console.log('[CleanupService] Restoring original system settings...');
      
      // Reset to default brokerage sharing settings
      await SystemSettings.updateOne(
        {},
        {
          $set: {
            'brokerageSharing': {
              enabled: true,
              mode: 'PERCENTAGE',
              superAdminShare: 20,
              adminShare: 25,
              brokerShare: 25,
              subBrokerShare: 30
            },
            'referralEligibility': {
              enabled: true,
              thresholdAmount: 1000,
              thresholdUnit: 'PER_CRORE'
            }
          }
        },
        { upsert: true }
      );
      
      console.log('[CleanupService] Original system settings restored');
      
    } catch (error) {
      console.error('[CleanupService] Error restoring original settings:', error);
    }
  }

  async validateCleanup(setupResult) {
    try {
      console.log('[CleanupService] Validating cleanup...');
      
      if (!setupResult) {
        console.log('[CleanupService] No setup result to validate');
        return true;
      }

      const { users, hierarchy } = setupResult;
      let cleanupValid = true;
      
      // Check if users are deleted
      if (users && Object.keys(users).length > 0) {
        const userIds = Object.values(users).map(user => user._id);
        const remainingUsers = await this.userRepository.countDocuments({ _id: { $in: userIds } });
        
        if (remainingUsers > 0) {
          console.log(`[CleanupService] Warning: ${remainingUsers} test users still exist`);
          cleanupValid = false;
        }
      }
      
      // Check if admins are deleted
      if (hierarchy && Object.keys(hierarchy).length > 0) {
        const adminIds = Object.values(hierarchy).map(admin => admin._id);
        const remainingAdmins = await this.adminRepository.countDocuments({ _id: { $in: adminIds } });
        
        if (remainingAdmins > 0) {
          console.log(`[CleanupService] Warning: ${remainingAdmins} test admins still exist`);
          cleanupValid = false;
        }
      }
      
      if (cleanupValid) {
        console.log('[CleanupService] ✅ Cleanup validation passed');
      } else {
        console.log('[CleanupService] ❌ Cleanup validation failed');
      }
      
      return cleanupValid;
      
    } catch (error) {
      console.error('[CleanupService] Error validating cleanup:', error);
      return false;
    }
  }

  async forceCleanup() {
    try {
      console.log('[CleanupService] Performing force cleanup of all test data...');
      
      // Delete all test users with specific pattern
      const userDeleteResult = await this.userRepository.deleteMany({
        username: { $regex: '_test$' }
      });
      
      // Delete all test admins with specific pattern
      const adminDeleteResult = await this.adminRepository.deleteMany({
        username: { $regex: '_test$' }
      });
      
      // Delete referral records for test users
      await this.referralRepository.deleteMany({});
      
      console.log(`[CleanupService] Force cleanup completed:`);
      console.log(`[CleanupService] - Deleted ${userDeleteResult.deletedCount} test users`);
      console.log(`[CleanupService] - Deleted ${adminDeleteResult.deletedCount} test admins`);
      
    } catch (error) {
      console.error('[CleanupService] Error during force cleanup:', error);
    }
  }
}
