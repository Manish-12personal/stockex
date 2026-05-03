/**
 * Referral Test Data Service
 * 
 * Manages test data creation and setup for referral test scenarios.
 * Follows SOLID principles with single responsibility for data management.
 */

import bcrypt from 'bcryptjs';

export class ReferralTestDataService {
  constructor(userRepository, adminRepository, referralRepository) {
    this.userRepository = userRepository;
    this.adminRepository = adminRepository;
    this.referralRepository = referralRepository;
  }

  async createTestUsers(userConfigs) {
    const users = {};
    const createdUsers = [];
    
    try {
      for (const [key, config] of Object.entries(userConfigs)) {
        console.log(`[TestDataService] Creating test user: ${config.username}`);
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(config.password, salt);
        
        // Create user with referral relationship
        const user = await this.userRepository.create({
          username: config.username,
          email: config.email,
          password: hashedPassword,
          referralCode: config.referralCode,
          referredBy: config.referredBy,
          isActive: true,
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        users[key] = user;
        createdUsers.push(user);
        
        console.log(`[TestDataService] Created user: ${user.username} (${user._id})`);
      }
      
      // Create referral records for users who were referred
      for (const [key, config] of Object.entries(userConfigs)) {
        if (config.referredBy) {
          console.log(`[TestDataService] Creating referral record for ${key} referred by ${config.referredBy}`);
          
          await this.referralRepository.create({
            referredUser: users[key]._id,
            referralCode: config.referredBy,
            referralClient: null, // Will be set after finding the referrer
            status: 'ACTIVE',
            createdAt: new Date()
          });
        }
      }
      
      // Update referral records with actual referrer IDs
      for (const [key, config] of Object.entries(userConfigs)) {
        if (config.referredBy) {
          const referrer = Object.values(users).find(u => u.referralCode === config.referredBy);
          if (referrer) {
            await this.referralRepository.updateOne(
              { referredUser: users[key]._id },
              { referralClient: referrer._id }
            );
            
            console.log(`[TestDataService] Updated referral record: ${users[key].username} referred by ${referrer.username}`);
          }
        }
      }
      
      return users;
      
    } catch (error) {
      console.error('[TestDataService] Error creating test users:', error);
      // Cleanup created users on failure
      if (createdUsers.length > 0) {
        await this.cleanupUsers(createdUsers);
      }
      throw error;
    }
  }

  async setupHierarchy(hierarchyConfig) {
    const hierarchy = {};
    const createdAdmins = [];
    
    try {
      // Create admins in order (Super Admin first, then down the hierarchy)
      const orderedHierarchy = this.getOrderedHierarchy(hierarchyConfig);
      
      for (const [key, config] of orderedHierarchy) {
        console.log(`[TestDataService] Creating admin: ${config.username} (${config.role})`);
        
        // Find parent ID if specified
        let parentId = null;
        if (config.parentId) {
          const parent = hierarchy[config.parentId];
          if (parent) {
            parentId = parent._id;
          }
        }
        
        // Create admin
        const admin = await this.adminRepository.create({
          username: config.username,
          adminCode: config.adminCode,
          role: config.role,
          parentId: parentId,
          status: 'ACTIVE',
          wallet: { 
            balance: 0,
            updatedAt: new Date()
          },
          temporaryWallet: { 
            balance: 0, 
            totalEarned: 0,
            updatedAt: new Date()
          },
          receivesHierarchyBrokerage: true,
          referralDistributionEnabled: true,
          createdAt: new Date(),
          updatedAt: new Date()
        });
        
        hierarchy[key] = admin;
        createdAdmins.push(admin);
        
        console.log(`[TestDataService] Created admin: ${admin.username} (${admin.role}) - Parent: ${parentId ? hierarchy[config.parentId]?.username : 'None'}`);
      }
      
      return hierarchy;
      
    } catch (error) {
      console.error('[TestDataService] Error setting up hierarchy:', error);
      // Cleanup created admins on failure
      if (createdAdmins.length > 0) {
        await this.cleanupAdmins(createdAdmins);
      }
      throw error;
    }
  }

  async assignUsersToAdmins(users, hierarchy) {
    try {
      console.log('[TestDataService] Assigning users to admins...');
      
      // Assign monishit to subbroker
      if (users.monishit && hierarchy.subBroker) {
        await this.userRepository.updateById(
          users.monishit._id,
          { admin: hierarchy.subBroker._id }
        );
        console.log(`[TestDataService] Assigned monishit to subbroker: ${hierarchy.subBroker.username}`);
      }
      
      // Assign hamsa to same subbroker (referred by monishit)
      if (users.hamsa && hierarchy.subBroker) {
        await this.userRepository.updateById(
          users.hamsa._id,
          { admin: hierarchy.subBroker._id }
        );
        console.log(`[TestDataService] Assigned hamsa to subbroker: ${hierarchy.subBroker.username}`);
      }
      
      console.log('[TestDataService] User assignment completed');
      
    } catch (error) {
      console.error('[TestDataService] Error assigning users to admins:', error);
      throw error;
    }
  }

  getOrderedHierarchy(hierarchyConfig) {
    // Order: Super Admin -> Admin -> Broker -> Sub Broker
    const order = ['SUPER_ADMIN', 'ADMIN', 'BROKER', 'SUB_BROKER'];
    const ordered = {};
    
    for (const role of order) {
      for (const [key, config] of Object.entries(hierarchyConfig)) {
        if (config.role === role) {
          ordered[key] = config;
          break;
        }
      }
    }
    
    return ordered;
  }

  async cleanupUsers(users) {
    try {
      console.log(`[TestDataService] Cleaning up ${users.length} users...`);
      
      // Delete referral records first
      const userIds = users.map(u => u._id);
      await this.referralRepository.deleteMany({ referredUser: { $in: userIds } });
      
      // Delete users
      await this.userRepository.deleteMany({ _id: { $in: userIds } });
      
      console.log('[TestDataService] User cleanup completed');
      
    } catch (error) {
      console.error('[TestDataService] Error cleaning up users:', error);
    }
  }

  async cleanupAdmins(admins) {
    try {
      console.log(`[TestDataService] Cleaning up ${admins.length} admins...`);
      
      const adminIds = admins.map(a => a._id);
      await this.adminRepository.deleteMany({ _id: { $in: adminIds } });
      
      console.log('[TestDataService] Admin cleanup completed');
      
    } catch (error) {
      console.error('[TestDataService] Error cleaning up admins:', error);
    }
  }

  async cleanupWalletLedger(testStartTime) {
    try {
      console.log('[TestDataService] Cleaning up wallet ledger entries...');
      
      // Delete ledger entries created during test
      await WalletLedger.deleteMany({
        createdAt: { $gte: testStartTime }
      });
      
      console.log('[TestDataService] Wallet ledger cleanup completed');
      
    } catch (error) {
      console.error('[TestDataService] Error cleaning up wallet ledger:', error);
    }
  }

  async cleanupSuperAdminEarnings(testStartTime) {
    try {
      console.log('[TestDataService] Cleaning up SuperAdmin earnings...');
      
      // Delete earnings records created during test
      await SuperAdminHierarchyEarnings.deleteMany({
        createdAt: { $gte: testStartTime }
      });
      
      console.log('[TestDataService] SuperAdmin earnings cleanup completed');
      
    } catch (error) {
      console.error('[TestDataService] Error cleaning up SuperAdmin earnings:', error);
    }
  }
}
