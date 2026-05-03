import mongoose from 'mongoose';

const superAdminHierarchyEarningsSchema = new mongoose.Schema({
  superAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  rootAdminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  earningsBySegment: {
    games: { type: Number, default: 0, min: 0 },
    trading: { type: Number, default: 0, min: 0 },
    mcx: { type: Number, default: 0, min: 0 },
    crypto: { type: Number, default: 0, min: 0 },
    forex: { type: Number, default: 0, min: 0 }
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index for unique superAdmin-rootAdmin combination
superAdminHierarchyEarningsSchema.index({ superAdminId: 1, rootAdminId: 1 }, { unique: true });

// Index for querying earnings by root admin
superAdminHierarchyEarningsSchema.index({ rootAdminId: 1, totalEarnings: -1 });

/**
 * Find or create earnings record for a hierarchy
 * @param {ObjectId} superAdminId - Super Admin ID
 * @param {ObjectId} rootAdminId - Root Admin ID (top of hierarchy)
 * @returns {Promise<Object>} Earnings document
 */
superAdminHierarchyEarningsSchema.statics.findOrCreateHierarchy = async function(superAdminId, rootAdminId) {
  let earnings = await this.findOne({ superAdminId, rootAdminId });
  if (!earnings) {
    earnings = await this.create({
      superAdminId,
      rootAdminId,
      totalEarnings: 0,
      earningsBySegment: {
        games: 0,
        trading: 0,
        mcx: 0,
        crypto: 0,
        forex: 0
      }
    });
  }
  return earnings;
};

/**
 * Add earnings to a hierarchy
 * @param {ObjectId} superAdminId - Super Admin ID
 * @param {ObjectId} rootAdminId - Root Admin ID
 * @param {number} amount - Amount to add
 * @param {string} segment - Segment ('games', 'trading', etc.)
 * @returns {Promise<Object>} Updated earnings document
 */
superAdminHierarchyEarningsSchema.statics.addEarnings = async function(superAdminId, rootAdminId, amount, segment) {
  const earnings = await this.findOrCreateHierarchy(superAdminId, rootAdminId);
  
  earnings.totalEarnings += amount;
  if (earnings.earningsBySegment[segment] !== undefined) {
    earnings.earningsBySegment[segment] += amount;
  }
  earnings.lastUpdated = new Date();
  
  await earnings.save();
  return earnings;
};

/**
 * Check if hierarchy has reached threshold
 * @param {ObjectId} rootAdminId - Root Admin ID
 * @param {number} threshold - Threshold amount (default 1000)
 * @param {string} unit - Unit ('PER_CRORE' or 'ABSOLUTE')
 * @returns {Promise<boolean>} Whether threshold is reached
 */
superAdminHierarchyEarningsSchema.statics.hasReachedThreshold = async function(rootAdminId, threshold = 1000, unit = 'PER_CRORE') {
  const earnings = await this.findOne({ rootAdminId, isActive: true });
  if (!earnings) return false;
  
  if (unit === 'PER_CRORE') {
    // Convert earnings to crores and check threshold
    const earningsInCrores = earnings.totalEarnings / 10000000; // 1 crore = 10,000,000
    return earningsInCrores >= threshold;
  } else {
    return earnings.totalEarnings >= threshold;
  }
};

/**
 * Get total earnings for a hierarchy
 * @param {ObjectId} rootAdminId - Root Admin ID
 * @returns {Promise<Object|null>} Earnings data
 */
superAdminHierarchyEarningsSchema.statics.getHierarchyEarnings = async function(rootAdminId) {
  return this.findOne({ rootAdminId, isActive: true });
};

/**
 * Get all hierarchies for a Super Admin
 * @param {ObjectId} superAdminId - Super Admin ID
 * @returns {Promise<Array>} Array of earnings documents
 */
superAdminHierarchyEarningsSchema.statics.getSuperAdminHierarchies = async function(superAdminId) {
  return this.find({ superAdminId, isActive: true }).populate('rootAdminId', 'username adminCode role');
};

const SuperAdminHierarchyEarnings = mongoose.model('SuperAdminHierarchyEarnings', superAdminHierarchyEarningsSchema);

export default SuperAdminHierarchyEarnings;
