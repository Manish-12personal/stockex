import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { protectAdmin, protectUser } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/notifications';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'notification-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Create notification (Admin/Super Admin)
router.post('/', protectAdmin, upload.single('image'), async (req, res) => {
  try {
    const { title, subject, description, targetType, targetUserId, targetUserIds, targetAdminCode } = req.body;
    
    if (!title || !subject || !description || !targetType) {
      return res.status(400).json({ message: 'Title, subject, description and target type are required' });
    }

    // Validate target type based on admin role
    const isSuperAdmin = req.admin.role === 'SUPER_ADMIN';
    
    if (!isSuperAdmin) {
      // Regular admin can only send to their own users or selected users
      if (targetType === 'ALL_ADMINS_USERS') {
        return res.status(403).json({ message: 'Only Super Admin can send to all admins users' });
      }
    }

    // Validate selected users target
    if (targetType === 'SELECTED_USERS') {
      let userIds = targetUserIds;
      if (typeof targetUserIds === 'string') {
        try {
          userIds = JSON.parse(targetUserIds);
        } catch (e) {
          return res.status(400).json({ message: 'Invalid user IDs format' });
        }
      }
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ message: 'At least one user must be selected' });
      }
    }

    // Validate admin users target
    if (targetType === 'ADMIN_USERS' && !targetAdminCode) {
      return res.status(400).json({ message: 'Target admin code is required for admin users notification' });
    }

    // Parse targetUserIds if it's a string
    let parsedUserIds = [];
    if (targetType === 'SELECTED_USERS' && targetUserIds) {
      parsedUserIds = typeof targetUserIds === 'string' ? JSON.parse(targetUserIds) : targetUserIds;
    }

    const notification = await Notification.create({
      title,
      subject,
      description,
      image: req.file ? `/uploads/notifications/${req.file.filename}` : null,
      senderType: req.admin.role,
      senderId: req.admin._id,
      senderAdminCode: req.admin.adminCode,
      targetType,
      targetUserIds: targetType === 'SELECTED_USERS' ? parsedUserIds : undefined,
      targetAdminCode: targetType === 'ADMIN_USERS' ? targetAdminCode : (targetType === 'ALL_USERS' && !isSuperAdmin ? req.admin.adminCode : undefined)
    });

    res.status(201).json({ message: 'Notification sent successfully', notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all notifications sent by admin (for admin dashboard)
router.get('/sent', protectAdmin, async (req, res) => {
  try {
    const query = { senderId: req.admin._id };
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get notifications for user
router.get('/user', protectUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;

    // Find notifications that target this user
    const notifications = await Notification.find({
      isActive: true,
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ]
    })
    .sort({ createdAt: -1 })
    .limit(50);

    // Add read status for each notification
    const notificationsWithReadStatus = notifications.map(notif => {
      const isRead = notif.readBy.some(r => r.userId.toString() === userId.toString());
      return {
        ...notif.toObject(),
        isRead
      };
    });

    res.json(notificationsWithReadStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mark notification as read
router.put('/:id/read', protectUser, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Check if already read
    const alreadyRead = notification.readBy.some(r => r.userId.toString() === req.user._id.toString());
    if (!alreadyRead) {
      notification.readBy.push({ userId: req.user._id });
      await notification.save();
    }

    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get unread notification count for user
router.get('/unread-count', protectUser, async (req, res) => {
  try {
    const userId = req.user._id;
    const userAdminCode = req.user.adminCode;

    const notifications = await Notification.find({
      isActive: true,
      $or: [
        { targetType: 'ALL_USERS' },
        { targetType: 'ALL_ADMINS_USERS' },
        { targetType: 'SINGLE_USER', targetUserId: userId },
        { targetType: 'SELECTED_USERS', targetUserIds: userId },
        { targetType: 'ADMIN_USERS', targetAdminCode: userAdminCode }
      ]
    });

    const unreadCount = notifications.filter(notif => 
      !notif.readBy.some(r => r.userId.toString() === userId.toString())
    ).length;

    res.json({ unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete notification (Admin only - can only delete own notifications)
router.delete('/:id', protectAdmin, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      senderId: req.admin._id
    });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    await notification.deleteOne();
    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
