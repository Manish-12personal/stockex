import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  image: {
    type: String,
    default: null
  },
  // Who sent the notification
  senderType: {
    type: String,
    enum: ['SUPER_ADMIN', 'ADMIN', 'SYSTEM'],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: function() { return this.senderType !== 'SYSTEM'; }
  },
  senderAdminCode: {
    type: String
  },
  // Target type: ALL_USERS, SINGLE_USER, SELECTED_USERS, ADMIN_USERS (all users of specific admin), ALL_ADMINS_USERS
  targetType: {
    type: String,
    enum: ['ALL_USERS', 'SINGLE_USER', 'SELECTED_USERS', 'ADMIN_USERS', 'ALL_ADMINS_USERS'],
    required: true
  },
  // For SINGLE_USER target (deprecated, use SELECTED_USERS)
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // For SELECTED_USERS target (multiple users)
  targetUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // For ADMIN_USERS target (all users of a specific admin)
  targetAdminCode: {
    type: String
  },
  // Users who have read this notification
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient querying
notificationSchema.index({ targetType: 1, targetUserId: 1, targetAdminCode: 1, createdAt: -1 });
notificationSchema.index({ senderType: 1, senderId: 1 });

export default mongoose.model('Notification', notificationSchema);
