/**
 * Notification Controller
 * 
 * Clean architecture implementation for user notification operations.
 * Handles notification management, read/unread status, and notification preferences.
 * 
 * Controller Responsibilities:
 * 1. Notification request validation and response formatting
 * 2. Notification business logic orchestration
 * 3. Read/unread status management
 * 4. Error handling and status codes
 */

import User from '../models/User.js';
import Notification from '../models/Notification.js';

// ==================== NOTIFICATION RETRIEVAL ====================

/**
 * Get user notifications
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getUserNotifications = async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const page = Math.max(parseInt(req.query.page, 1) || 1, 1);
    const skip = (page - 1) * limit;
    const type = req.query.type || '';
    const isRead = req.query.isRead !== undefined ? req.query.isRead === 'true' : undefined;
    
    // Build query
    let query = {
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ],
      isActive: true
    };
    
    // Add type filter if specified
    if (type) {
      query.type = type;
    }
    
    // Add read status filter if specified
    if (isRead !== undefined) {
      query.readBy = isRead ? { $in: [userId] } : { $nin: [userId] };
    }
    
    // Get notifications
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1, priority: -1 })
      .skip(skip)
      .limit(limit);
    
    // Get total count for pagination
    const total = await Notification.countDocuments(query);
    
    // Format notifications
    const formattedNotifications = notifications.map(notification => ({
      id: notification._id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      isRead: notification.readBy?.includes(userId) || false,
      createdAt: notification.createdAt,
      expiresAt: notification.expiresAt,
      metadata: notification.metadata || {}
    }));
    
    res.json({
      notifications: formattedNotifications,
      pagination: {
        current: page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('[NotificationController] Error getting user notifications:', error);
    res.status(500).json({ message: 'Failed to get notifications' });
  }
};

// ==================== NOTIFICATION STATUS MANAGEMENT ====================

/**
 * Mark notification as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user can access this notification
    const canAccess = await checkNotificationAccess(notification, userId);
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Mark as read
    if (!notification.readBy.includes(userId)) {
      notification.readBy.push(userId);
      await notification.save();
    }
    
    res.json({
      message: 'Notification marked as read',
      notification: {
        id: notification._id,
        isRead: true
      }
    });
  } catch (error) {
    console.error('[NotificationController] Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read' });
  }
};

/**
 * Mark all notifications as read
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const markAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;
    
    // Find all unread notifications for user
    const notifications = await Notification.find({
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ],
      isActive: true,
      readBy: { $nin: [userId] }
    });
    
    // Mark all as read
    const updatePromises = notifications.map(notification => {
      notification.readBy.push(userId);
      return notification.save();
    });
    
    await Promise.all(updatePromises);
    
    res.json({
      message: 'All notifications marked as read',
      count: notifications.length
    });
  } catch (error) {
    console.error('[NotificationController] Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read' });
  }
};

/**
 * Mark notification as unread
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const markNotificationUnread = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    // Check if user can access this notification
    const canAccess = await checkNotificationAccess(notification, userId);
    if (!canAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Remove user from readBy array
    notification.readBy = notification.readBy.filter(id => id.toString() !== userId.toString());
    await notification.save();
    
    res.json({
      message: 'Notification marked as unread',
      notification: {
        id: notification._id,
        isRead: false
      }
    });
  } catch (error) {
    console.error('[NotificationController] Error marking notification as unread:', error);
    res.status(500).json({ message: 'Failed to mark notification as unread' });
  }
};

// ==================== NOTIFICATION PREFERENCES ====================

/**
 * Get notification settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getNotificationSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notificationSettings');
    
    const defaultSettings = {
      emailNotifications: true,
      pushNotifications: true,
      smsNotifications: false,
      tradingAlerts: true,
      gameAlerts: true,
      fundAlerts: true,
      marketingEmails: false
    };
    
    res.json({
      settings: user.notificationSettings || defaultSettings
    });
  } catch (error) {
    console.error('[NotificationController] Error getting notification settings:', error);
    res.status(500).json({ message: 'Failed to get notification settings' });
  }
};

/**
 * Update notification settings
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const settings = req.body;
    
    // Validate settings
    const validSettings = [
      'emailNotifications',
      'pushNotifications', 
      'smsNotifications',
      'tradingAlerts',
      'gameAlerts',
      'fundAlerts',
      'marketingEmails'
    ];
    
    const updateData = {};
    for (const setting of validSettings) {
      if (settings[setting] !== undefined) {
        updateData[setting] = Boolean(settings[setting]);
      }
    }
    
    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { notificationSettings: updateData } },
      { new: true, upsert: true }
    ).select('notificationSettings');
    
    res.json({
      message: 'Notification settings updated successfully',
      settings: user.notificationSettings
    });
  } catch (error) {
    console.error('[NotificationController] Error updating notification settings:', error);
    res.status(500).json({ message: 'Failed to update notification settings' });
  }
};

// ==================== NOTIFICATION ANALYTICS ====================

/**
 * Get notification statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
export const getNotificationStats = async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;
    
    // Get total notifications
    const totalQuery = {
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ],
      isActive: true
    };
    
    const total = await Notification.countDocuments(totalQuery);
    
    // Get unread notifications
    const unreadQuery = {
      ...totalQuery,
      readBy: { $nin: [userId] }
    };
    const unread = await Notification.countDocuments(unreadQuery);
    
    // Get notifications by type
    const typeStats = await Notification.aggregate([
      { $match: totalQuery },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    // Get recent notifications (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await Notification.countDocuments({
      ...totalQuery,
      createdAt: { $gte: sevenDaysAgo }
    });
    
    res.json({
      stats: {
        total,
        unread,
        read: total - unread,
        recent,
        byType: typeStats.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('[NotificationController] Error getting notification stats:', error);
    res.status(500).json({ message: 'Failed to get notification statistics' });
  }
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Check if user can access notification
 * @param {Object} notification - Notification document
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether user can access notification
 */
async function checkNotificationAccess(notification, userId) {
  const user = await User.findById(userId).select('adminCode');
  if (!user) return false;
  
  switch (notification.targetType) {
    case 'ALL_USERS':
    case 'ALL_ADMINS_USERS':
      return true;
    case 'SINGLE_USER':
      return notification.targetUserId.toString() === userId;
    case 'SELECTED_USERS':
      return notification.targetUserIds.includes(userId);
    case 'ADMIN_USERS':
      return notification.targetAdminCode === user.adminCode;
    default:
      return false;
  }
}
