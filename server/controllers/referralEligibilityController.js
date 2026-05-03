import { 
  getAllSuperAdminHierarchies,
  getHierarchyEarnings,
  updateReferralEligibilitySettings,
  getReferralEligibilitySettings as getSettings
} from '../services/superAdminEarningsService.js';
import { 
  releaseHeldReferralCommissions,
  getHeldReferralCommissions,
  getReferralPayoutStatistics
} from '../services/referralPayoutService.js';

/**
 * Referral Eligibility Controller
 * Handles API endpoints for referral eligibility management
 * Follows SOLID principles with single responsibility
 */

/**
 * Get all Super Admin hierarchies with earnings (Super Admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getAllHierarchies = async (req, res) => {
  try {
    const hierarchies = await getAllSuperAdminHierarchies();
    res.json({
      success: true,
      data: hierarchies || []
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error getting hierarchies:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hierarchies',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get earnings for a specific hierarchy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getHierarchyEarningsById = async (req, res) => {
  try {
    const { rootAdminId } = req.params;
    
    if (!rootAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Root admin ID is required'
      });
    }

    const earnings = await getHierarchyEarnings(rootAdminId);
    
    if (!earnings) {
      return res.status(404).json({
        success: false,
        message: 'Hierarchy earnings not found'
      });
    }

    res.json({
      success: true,
      data: earnings
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error getting hierarchy earnings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get referral eligibility settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getReferralEligibilitySettings = async (req, res) => {
  try {
    const settings = await getSettings();
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error getting referral eligibility settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Update referral eligibility settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateReferralEligibilitySettingsHandler = async (req, res) => {
  try {
    const { enabled, thresholdAmount, thresholdUnit } = req.body;
    
    // Validate input
    if (thresholdAmount !== undefined && (typeof thresholdAmount !== 'number' || thresholdAmount <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Threshold amount must be a positive number'
      });
    }
    
    if (thresholdUnit !== undefined && !['PER_CRORE', 'ABSOLUTE'].includes(thresholdUnit)) {
      return res.status(400).json({
        success: false,
        message: 'Threshold unit must be either PER_CRORE or ABSOLUTE'
      });
    }

    const settings = await updateReferralEligibilitySettings({
      enabled,
      thresholdAmount,
      thresholdUnit
    });

    res.json({
      success: true,
      message: 'Referral eligibility settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error updating referral eligibility settings:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get held referral commissions for a hierarchy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getHeldCommissions = async (req, res) => {
  try {
    const { rootAdminId } = req.params;
    
    if (!rootAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Root admin ID is required'
      });
    }

    const heldCommissions = await getHeldReferralCommissions(rootAdminId);
    
    res.json({
      success: true,
      data: heldCommissions
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error getting held commissions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Release held referral commissions for a hierarchy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const releaseHeldCommissions = async (req, res) => {
  try {
    const { rootAdminId } = req.params;
    
    if (!rootAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Root admin ID is required'
      });
    }

    const result = await releaseHeldReferralCommissions(rootAdminId);
    
    res.json({
      success: true,
      message: 'Held commissions processed',
      data: result
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error releasing held commissions:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get referral payout statistics for a hierarchy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getPayoutStatistics = async (req, res) => {
  try {
    const { rootAdminId } = req.params;
    
    if (!rootAdminId) {
      return res.status(400).json({
        success: false,
        message: 'Root admin ID is required'
      });
    }

    const statistics = await getReferralPayoutStatistics(rootAdminId);
    
    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error getting payout statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get referral eligibility status for a specific user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getUserReferralEligibility = async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, segment } = req.query;
    
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    if (!amount || !segment) {
      return res.status(400).json({
        success: false,
        message: 'Amount and segment are required'
      });
    }

    const { isReferralEligible } = await import('../services/referralEligibilityService.js');
    const eligibility = await isReferralEligible(userId, parseFloat(amount), segment);
    
    res.json({
      success: true,
      data: eligibility
    });
  } catch (error) {
    console.error('[ReferralEligibilityController] Error checking user referral eligibility:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
