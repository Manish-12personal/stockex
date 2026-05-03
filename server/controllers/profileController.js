/**
 * Profile Controller
 * 
 * Clean architecture implementation for user profile operations.
 * Handles profile management, updates, and related operations.
 * 
 * Controller Responsibilities:
 * 1. Profile request validation and response formatting
 * 2. Profile business logic orchestration
 * 3. Error handling and status codes
 */

import { 
  getUserProfile as getUserProfileService,
  updateUserProfile as updateUserProfileService,
  changeUserPassword as changeUserPasswordService,
  validateProfileUpdate,
  validatePasswordChange
} from '../services/userService.js';

// ==================== PROFILE OPERATIONS ====================

/**
 * Get user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const userProfile = await getUserProfileService(userId);
    
    res.json({
      profile: {
        id: userProfile._id,
        username: userProfile.username,
        email: userProfile.email,
        fullName: userProfile.fullName,
        phone: userProfile.phone,
        phoneVerified: userProfile.phoneVerified,
        adminCode: userProfile.adminCode,
        referralCode: userProfile.referralCode,
        isDemo: userProfile.isDemo,
        isActive: userProfile.isActive,
        createdAt: userProfile.createdAt,
        updatedAt: userProfile.updatedAt
      }
    });
  } catch (error) {
    console.error('[ProfileController] Error getting user profile:', error);
    res.status(500).json({ message: 'Failed to get profile' });
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const updateData = req.body;
    
    const updatedProfile = await updateUserProfileService(userId, updateData);
    
    res.json({
      message: 'Profile updated successfully',
      profile: {
        id: updatedProfile._id,
        username: updatedProfile.username,
        email: updatedProfile.email,
        fullName: updatedProfile.fullName,
        phone: updatedProfile.phone,
        phoneVerified: updatedProfile.phoneVerified,
        adminCode: updatedProfile.adminCode,
        referralCode: updatedProfile.referralCode,
        updatedAt: updatedProfile.updatedAt
      }
    });
  } catch (error) {
    console.error('[ProfileController] Error updating user profile:', error);
    res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
};

/**
 * Change user password
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const changeUserPassword = async (req, res) => {
  try {
    const userId = req.user._id;
    const { oldPassword, newPassword } = req.body;
    
    await changeUserPasswordService(userId, { oldPassword, newPassword });
    
    res.json({
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('[ProfileController] Error changing user password:', error);
    res.status(500).json({ message: error.message || 'Failed to change password' });
  }
};
