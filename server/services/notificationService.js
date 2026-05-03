/**
 * Notification Service
 * 
 * Clean architecture implementation for notification business logic.
 * Handles notification creation, delivery, filtering, and management.
 * 
 * Service Responsibilities:
 * 1. Notification creation and validation
 * 2. Notification delivery and routing
 * 3. Notification filtering and targeting
 * 4. Notification status management
 */

import User from '../models/User.js';
import Admin from '../models/Admin.js';
import Notification from '../models/Notification.js';

// ==================== NOTIFICATION CREATION ====================

/**
 * Create a new notification
 * @param {Object} notificationData - Notification data
 * @returns {Promise<Object>} - Created notification
 */
export const createNotification = async (notificationData) => {
  const {
    title,
    message,
    type,
    priority = 'NORMAL',
    targetType,
    targetUserId,
    targetUserIds,
    targetAdminCode,
    isActive = true,
    expiresAt,
    metadata = {}
  } = notificationData;

  // Validate notification data
  await validateNotificationData(notificationData);

  // Create notification
  const notification = await Notification.create({
    title,
    message,
    type,
    priority,
    targetType,
    targetUserId,
    targetUserIds,
    targetAdminCode,
    isActive,
    expiresAt,
    metadata,
    createdAt: new Date()
  });

  // Process notification delivery
  await processNotificationDelivery(notification);

  return notification;
};

/**
 * Create bulk notifications
 * @param {Array} notificationDataArray - Array of notification data
 * @returns {Promise<Array>} - Created notifications
 */
export const createBulkNotifications = async (notificationDataArray) => {
  const notifications = await Promise.all(
    notificationDataArray.map(data => createNotification(data))
  );
  
  return notifications;
};

/**
 * Create system notification
 * @param {Object} systemData - System notification data
 * @returns {Promise<Object>} - Created notification
 */
export const createSystemNotification = async (systemData) => {
  const { title, message, priority = 'HIGH', metadata = {} } = systemData;

  return await createNotification({
    title,
    message,
    type: 'SYSTEM',
    priority,
    targetType: 'ALL_USERS',
    isActive: true,
    metadata: {
      ...metadata,
      isSystem: true
    }
  });
};

// ==================== NOTIFICATION DELIVERY ====================

/**
 * Process notification delivery to target users
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const processNotificationDelivery = async (notification) => {
  switch (notification.targetType) {
    case 'ALL_USERS':
      await deliverToAllUsers(notification);
      break;
    case 'ALL_ADMINS_USERS':
      await deliverToAllAdminsUsers(notification);
      break;
    case 'SINGLE_USER':
      await deliverToSingleUser(notification);
      break;
    case 'SELECTED_USERS':
      await deliverToSelectedUsers(notification);
      break;
    case 'ADMIN_USERS':
      await deliverToAdminUsers(notification);
      break;
  }
};

/**
 * Deliver notification to all users
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const deliverToAllUsers = async (notification) => {
  // For ALL_USERS, no additional delivery logic needed
  // Users will see this when they query notifications
  console.log(`[NotificationService] Delivered to all users: ${notification.title}`);
};

/**
 * Deliver notification to all admins' users
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const deliverToAllAdminsUsers = async (notification) => {
  // For ALL_ADMINS_USERS, no additional delivery logic needed
  console.log(`[NotificationService] Delivered to all admins' users: ${notification.title}`);
};

/**
 * Deliver notification to single user
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const deliverToSingleUser = async (notification) => {
  const user = await User.findById(notification.targetUserId);
  if (user) {
    console.log(`[NotificationService] Delivered to user ${user.username}: ${notification.title}`);
  }
};

/**
 * Deliver notification to selected users
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const deliverToSelectedUsers = async (notification) => {
  const users = await User.find({ _id: { $in: notification.targetUserIds } });
  console.log(`[NotificationService] Delivered to ${users.length} selected users: ${notification.title}`);
};

/**
 * Deliver notification to admin's users
 * @param {Object} notification - Notification object
 * @returns {Promise<void>}
 */
export const deliverToAdminUsers = async (notification) => {
  const users = await User.find({ adminCode: notification.targetAdminCode });
  console.log(`[NotificationService] Delivered to ${users.length} users of admin ${notification.targetAdminCode}: ${notification.title}`);
};

// ==================== NOTIFICATION FILTERING ====================

/**
 * Filter notifications for user
 * @param {string} userId - User ID
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>} - Filtered notifications
 */
export const filterNotifications = async (userId, filters = {}) => {
  const { type, isRead, limit = 50, page = 1 } = filters;
  const skip = (page - 1) * limit;

  // Get user's admin code for admin-specific notifications
  const user = await User.findById(userId).select('adminCode');
  if (!user) {
    throw new Error('User not found');
  }

  // Build base query
  let query = {
    $or: [
      { targetType: 'ALL_USERS' },
      { targetType: 'ALL_ADMINS_USERS' },
      { targetType: 'SINGLE_USER', targetUserId: userId },
      { targetType: 'SELECTED_USERS', targetUserIds: userId },
      { targetType: 'ADMIN_USERS', targetAdminCode: user.adminCode }
    ],
    isActive: true
  };

  // Add type filter
  if (type) {
    query.type = type;
  }

  // Add read status filter
  if (isRead !== undefined) {
    query.readBy = isRead ? { $in: [userId] } : { $nin: [userId] };
  }

  // Add expiration filter
  query.$or = query.$or.map(condition => ({
    ...condition,
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  }));

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

  return {
    notifications: formattedNotifications,
    pagination: {
      current: page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  };
};

/**
 * Get unread notifications count for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Unread count
 */
export const getUnreadCount = async (userId) => {
  const user = await User.findById(userId).select('adminCode');
  if (!user) {
    throw new Error('User not found');
  }

  const query = {
    $or: [
      { targetType: 'ALL_USERS' },
      { targetType: 'ALL_ADMINS_USERS' },
      { targetType: 'SINGLE_USER', targetUserId: userId },
      { targetType: 'SELECTED_USERS', targetUserIds: userId },
      { targetType: 'ADMIN_USERS', targetAdminCode: user.adminCode }
    ],
    isActive: true,
    readBy: { $nin: [userId] },
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } }
    ]
  };

  return await Notification.countDocuments(query);
};

// ==================== NOTIFICATION STATUS MANAGEMENT ====================

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Updated notification
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }

  // Check if user can access this notification
  const canAccess = await checkNotificationAccess(notification, userId);
  if (!canAccess) {
    throw new Error('Access denied');
  }

  // Mark as read
  if (!notification.readBy.includes(userId)) {
    notification.readBy.push(userId);
    await notification.save();
  }

  return {
    id: notification._id,
    isRead: true
  };
};

/**
 * Mark notification as unread
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Updated notification
 */
export const markNotificationAsUnread = async (notificationId, userId) => {
  const notification = await Notification.findById(notificationId);
  if (!notification) {
    throw new Error('Notification not found');
  }

  // Check if user can access this notification
  const canAccess = await checkNotificationAccess(notification, userId);
  if (!canAccess) {
    throw new Error('Access denied');
  }

  // Remove user from readBy array
  notification.readBy = notification.readBy.filter(id => id.toString() !== userId.toString());
  await notification.save();

  return {
    id: notification._id,
    isRead: false
  };
};

/**
 * Mark all notifications as read for user
 * @param {string} userId - User ID
 * @returns {Promise<number>} - Number of notifications marked as read
 */
export const markAllAsRead = async (userId) => {
  const user = await User.findById(userId).select('adminCode');
  if (!user) {
    throw new Error('User not found');
  }

  // Find all unread notifications for user
  const notifications = await Notification.find({
    $or: [
      { targetType: 'ALL_USERS' },
      { targetType: 'ALL_ADMINS_USERS' },
      { targetType: 'SINGLE_USER', targetUserId: userId },
      { targetType: 'SELECTED_USERS', targetUserIds: userId },
      { targetType: 'ADMIN_USERS', targetAdminCode: user.adminCode }
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

  return notifications.length;
};

// ==================== NOTIFICATION ANALYTICS ====================

/**
 * Get notification statistics
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Notification statistics
 */
export const getNotificationStats = async (userId) => {
  const user = await User.findById(userId).select('adminCode');
  if (!user) {
    throw new Error('User not found');
  }

  // Get total notifications
  const totalQuery = {
    $or: [
      { targetType: 'ALL_USERS' },
      { targetType: 'ALL_ADMINS_USERS' },
      { targetType: 'SINGLE_USER', targetUserId: userId },
      { targetType: 'SELECTED_USERS', targetUserIds: userId },
      { targetType: 'ADMIN_USERS', targetAdminCode: user.adminCode }
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

  return {
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
  };
};

// ==================== NOTIFICATION CLEANUP ====================

/**
 * Clean up expired notifications
 * @returns {Promise<number>} - Number of notifications cleaned up
 */
export const cleanupExpiredNotifications = async () => {
  const result = await Notification.deleteMany({
    expiresAt: { $lt: new Date() }
  });

  return result.deletedCount;
};

/**
 * Deactivate old notifications
 * @param {number} daysOld - Age in days to deactivate
 * @returns {Promise<number>} - Number of notifications deactivated
 */
export const deactivateOldNotifications = async (daysOld = 30) => {
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
  
  const result = await Notification.updateMany(
    {
      createdAt: { $lt: cutoffDate },
      isActive: true
    },
    { isActive: false }
  );

  return result.modifiedCount;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Validate notification data
 * @param {Object} notificationData - Notification data
 * @returns {Promise<void>}
 */
export const validateNotificationData = async (notificationData) => {
  const { title, message, type, targetType } = notificationData;

  if (!title || title.trim().length === 0) {
    throw new Error('Title is required');
  }

  if (!message || message.trim().length === 0) {
    throw new Error('Message is required');
  }

  if (!type) {
    throw new Error('Type is required');
  }

  const validTypes = ['INFO', 'SUCCESS', 'WARNING', 'ERROR', 'SYSTEM', 'TRADING', 'GAME', 'FINANCIAL'];
  if (!validTypes.includes(type)) {
    throw new Error(`Invalid type. Valid types: ${validTypes.join(', ')}`);
  }

  const validTargetTypes = ['ALL_USERS', 'ALL_ADMINS_USERS', 'SINGLE_USER', 'SELECTED_USERS', 'ADMIN_USERS'];
  if (!validTargetTypes.includes(targetType)) {
    throw new Error(`Invalid target type. Valid types: ${validTargetTypes.join(', ')}`);
  }

  // Validate target-specific requirements
  switch (targetType) {
    case 'SINGLE_USER':
      if (!notificationData.targetUserId) {
        throw new Error('Target user ID is required for SINGLE_USER type');
      }
      break;
    case 'SELECTED_USERS':
      if (!notificationData.targetUserIds || !Array.isArray(notificationData.targetUserIds)) {
        throw new Error('Target user IDs array is required for SELECTED_USERS type');
      }
      break;
    case 'ADMIN_USERS':
      if (!notificationData.targetAdminCode) {
        throw new Error('Target admin code is required for ADMIN_USERS type');
      }
      break;
  }
};

/**
 * Check if user can access notification
 * @param {Object} notification - Notification object
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} - Whether user can access notification
 */
export const checkNotificationAccess = async (notification, userId) => {
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
};
