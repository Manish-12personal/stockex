import express from 'express';
import { alignSegmentDefaultsMap } from '../utils/commissionTypeUnit.js';
import bcrypt from 'bcryptjs';
import Admin from '../models/Admin.js';
import User from '../models/User.js';
import BankSettings from '../models/BankSettings.js';
import SystemSettings from '../models/SystemSettings.js';
import { protectAdmin, generateToken } from '../middleware/auth.js';

const router = express.Router();

// Get admin branding by referral code (public endpoint for login page)
router.get('/branding/:refCode', async (req, res) => {
  try {
    const admin = await Admin.findOne({ referralCode: req.params.refCode });
    
    if (!admin) {
      return res.json({ brandName: '', logoUrl: '', welcomeTitle: '' });
    }
    
    res.json({
      brandName: admin.branding?.brandName || '',
      logoUrl: admin.branding?.logoUrl || '',
      welcomeTitle: admin.branding?.welcomeTitle || ''
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users under a Demo Broker (Super Admin only)
router.get('/demo-broker/:id/users', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can view demo broker users' });
    }
    
    const users = await User.find({ admin: req.params.id })
      .select('username name email phone isDemo wallet.balance isActive createdAt')
      .sort({ createdAt: -1 });
    
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get list of brokers for user registration (public endpoint)
router.get('/brokers/public', async (req, res) => {
  try {
    // Fetch all active brokers only (not sub-brokers)
    const brokers = await Admin.find({ 
      role: 'BROKER',
      status: 'ACTIVE'
    })
    .select('name username adminCode role parentId branding')
    .populate('parentId', 'name username adminCode role')
    .sort({ name: 1 });

    res.json({ brokers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email }).populate('parentId', 'adminCode name username role');

    if (!admin) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if admin is active
    if (admin.status === 'SUSPENDED' || admin.status === 'INACTIVE') {
      return res.status(401).json({ message: 'Account is suspended' });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Update last login time
    admin.lastLoginAt = new Date();
    await admin.save();

    // Get parent admin info
    const parentAdmin = admin.parentId ? {
      adminCode: admin.parentId.adminCode,
      name: admin.parentId.name || admin.parentId.username,
      role: admin.parentId.role
    } : null;

    // Return all necessary fields (admins can login from multiple devices)
    res.json({
      _id: admin._id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      adminCode: admin.adminCode,
      referralCode: admin.referralCode,
      referralUrl: admin.referralUrl,
      wallet: admin.wallet,
      charges: admin.charges,
      stats: admin.stats,
      parentAdmin: parentAdmin,
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get parent admin info by email (for showing on login form)
router.post('/parent-info', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }
    
    const admin = await Admin.findOne({ email }).populate('parentId', 'adminCode name username role');
    
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Build full hierarchy chain
    const hierarchy = [];
    let currentAdmin = admin;
    
    while (currentAdmin) {
      hierarchy.unshift({
        adminCode: currentAdmin.adminCode,
        name: currentAdmin.name || currentAdmin.username || currentAdmin.adminCode,
        role: currentAdmin.role
      });
      
      // Fetch parent if exists
      if (currentAdmin.parentId) {
        currentAdmin = await Admin.findById(currentAdmin.parentId).select('adminCode name username role parentId');
      } else {
        currentAdmin = null;
      }
    }
    
    res.json({
      parentAdmin: hierarchy[hierarchy.length - 1] || null,
      hierarchy: hierarchy,
      currentRole: admin.role
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Admin Logout (just clears local storage on client, no server action needed for multi-device)
router.post('/logout', protectAdmin, async (req, res) => {
  try {
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// DEMO BROKER REGISTRATION
// ============================================================================

// Create Demo Broker Account (No auth required - public endpoint)
router.post('/demo-broker', async (req, res) => {
  try {
    const { name, email, phone, password, pin } = req.body;
    
    // Validate required fields
    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Name, email and phone are required' });
    }
    
    // Check if email already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      return res.status(400).json({ message: 'Email already registered. Please use a different email.' });
    }
    
    // Generate unique username from name
    const timestamp = Date.now();
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 15);
    const demoUsername = `demo_${cleanName}_${Math.floor(Math.random() * 1000)}`;
    const demoPassword = password || 'demo1234';
    const demoPin = pin || '1234';
    
    // No automatic expiry - Super Admin will set it manually
    
    // Generate admin code for demo broker
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let adminCode = 'DEMO';
    for (let i = 0; i < 4; i++) {
      adminCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Generate referral code
    let referralCode = 'DEM';
    for (let i = 0; i < 5; i++) {
      referralCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    // Create demo broker
    const demoBroker = await Admin.create({
      username: demoUsername,
      name: name,
      email: email,
      phone: phone,
      password: demoPassword,
      pin: demoPin,
      role: 'BROKER',
      status: 'ACTIVE',
      isActive: true,
      isDemo: true,
      demoExpiresAt: null, // No automatic expiry - Super Admin sets manually
      demoCreatedAt: new Date(),
      adminCode,
      referralCode,
      referralUrl: `/register?ref=${referralCode}`,
      hierarchyLevel: 2,
      wallet: {
        balance: 100000, // Demo balance
        blocked: 0,
        totalDeposited: 100000,
        totalWithdrawn: 0
      },
      charges: {
        brokerage: 20
      },
      // Demo broker has restrict mode enabled by default
      restrictMode: {
        enabled: true,
        maxUsers: 10, // Demo broker can only create 10 demo users
        maxSubBrokers: 2
      }
    });
    
    // Generate token
    const token = generateToken(demoBroker._id);
    
    res.status(201).json({
      message: 'Demo broker account created successfully',
      _id: demoBroker._id,
      username: demoBroker.username,
      name: demoBroker.name,
      email: demoBroker.email,
      phone: demoBroker.phone,
      role: demoBroker.role,
      adminCode: demoBroker.adminCode,
      referralCode: demoBroker.referralCode,
      wallet: demoBroker.wallet,
      isDemo: true,
      demoExpiresAt,
      demoPassword: demoPassword,
      demoPin: demoPin,
      token
    });
  } catch (error) {
    console.error('Demo broker creation error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Set Demo Broker Expiry (Super Admin only)
router.put('/demo-broker/:id/expiry', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can set demo broker expiry' });
    }
    
    const { expiryDays, removeExpiry } = req.body;
    
    const demoBroker = await Admin.findById(req.params.id);
    if (!demoBroker) {
      return res.status(404).json({ message: 'Broker not found' });
    }
    
    if (!demoBroker.isDemo) {
      return res.status(400).json({ message: 'This broker is not a demo broker' });
    }
    
    if (removeExpiry) {
      // Remove expiry - demo broker will never expire
      demoBroker.demoExpiresAt = null;
      await demoBroker.save();
      return res.json({
        message: 'Demo broker expiry removed. Broker will not expire automatically.',
        broker: {
          _id: demoBroker._id,
          name: demoBroker.name,
          demoExpiresAt: null
        }
      });
    }
    
    if (!expiryDays || expiryDays < 1) {
      return res.status(400).json({ message: 'Please provide valid expiry days (minimum 1 day)' });
    }
    
    // Set expiry from today
    const demoExpiresAt = new Date();
    demoExpiresAt.setDate(demoExpiresAt.getDate() + parseInt(expiryDays));
    
    demoBroker.demoExpiresAt = demoExpiresAt;
    await demoBroker.save();
    
    res.json({
      message: `Demo broker expiry set to ${expiryDays} days from now.`,
      broker: {
        _id: demoBroker._id,
        name: demoBroker.name,
        demoExpiresAt: demoExpiresAt
      }
    });
  } catch (error) {
    console.error('Set demo broker expiry error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Convert Demo Broker to Normal Broker (Super Admin only)
router.post('/convert-demo-broker/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can convert demo brokers' });
    }
    
    const demoBroker = await Admin.findById(req.params.id);
    if (!demoBroker) {
      return res.status(404).json({ message: 'Broker not found' });
    }
    
    if (!demoBroker.isDemo) {
      return res.status(400).json({ message: 'This broker is not a demo broker' });
    }
    
    // Delete all demo users under this broker
    const deletedUsers = await User.deleteMany({ 
      admin: demoBroker._id,
      isDemo: true 
    });
    
    // Convert demo broker to normal broker
    demoBroker.isDemo = false;
    demoBroker.demoExpiresAt = null;
    demoBroker.wallet.balance = 0; // Reset balance
    demoBroker.wallet.totalDeposited = 0;
    demoBroker.restrictMode.enabled = false; // Remove restrict mode
    
    await demoBroker.save();
    
    res.json({
      message: `Demo broker converted to normal broker. ${deletedUsers.deletedCount} demo users deleted.`,
      broker: {
        _id: demoBroker._id,
        username: demoBroker.username,
        name: demoBroker.name,
        isDemo: false
      },
      deletedUsersCount: deletedUsers.deletedCount
    });
  } catch (error) {
    console.error('Convert demo broker error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all Demo Brokers (Super Admin only)
router.get('/demo-brokers', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can view demo brokers' });
    }
    
    const demoBrokers = await Admin.find({ isDemo: true })
      .select('username name email adminCode referralCode wallet stats isDemo demoExpiresAt demoCreatedAt status createdAt')
      .sort({ createdAt: -1 });
    
    // Get user counts for each demo broker
    const brokersWithCounts = await Promise.all(demoBrokers.map(async (broker) => {
      const userCount = await User.countDocuments({ admin: broker._id });
      const demoUserCount = await User.countDocuments({ admin: broker._id, isDemo: true });
      return {
        ...broker.toObject(),
        userCount,
        demoUserCount
      };
    }));
    
    res.json(brokersWithCounts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete Demo Broker and all its users (Super Admin only)
router.delete('/demo-broker/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete demo brokers' });
    }
    
    const demoBroker = await Admin.findById(req.params.id);
    if (!demoBroker) {
      return res.status(404).json({ message: 'Broker not found' });
    }
    
    if (!demoBroker.isDemo) {
      return res.status(400).json({ message: 'This broker is not a demo broker. Use permanent delete instead.' });
    }
    
    // Delete all users under this demo broker
    const deletedUsers = await User.deleteMany({ admin: demoBroker._id });
    
    // Delete the demo broker
    await Admin.findByIdAndDelete(demoBroker._id);
    
    res.json({
      message: `Demo broker and ${deletedUsers.deletedCount} users deleted successfully`,
      deletedUsersCount: deletedUsers.deletedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// LOGIN AS USER (Super Admin Only)
// ============================================================================

/**
 * POST /login-as-user/:id
 * Super Admin can login as any user without password
 */
router.post('/login-as-user/:id', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can use this feature
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can login as user' });
    }
    
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Generate token for the user (bypassing password check)
    // Clear any existing session to allow superadmin login
    const sessionToken = `sa-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 15)}`;
    
    await User.updateOne(
      { _id: user._id },
      { 
        activeSessionToken: sessionToken,
        lastLoginAt: new Date(),
        lastLoginDevice: 'SuperAdmin Login'
      }
    );
    
    res.json({
      _id: user._id,
      userId: user.userId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      wallet: user.wallet,
      marginAvailable: user.marginAvailable,
      isReadOnly: user.isReadOnly || false,
      isDemo: user.isDemo || false,
      isSuperAdminLogin: true,
      token: generateToken(user._id, sessionToken),
      message: `Logged in as user: ${user.username}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============================================================================
// LOGIN AS ADMIN/BROKER/SUBBROKER (Super Admin Only)
// ============================================================================

/**
 * POST /login-as-admin/:id
 * Super Admin can login as any admin/broker/sub-broker without password
 */
router.post('/login-as-admin/:id', protectAdmin, async (req, res) => {
  try {
    // Only Super Admin can use this feature
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can login as other admins' });
    }
    
    const targetAdmin = await Admin.findById(req.params.id);
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    
    // Cannot login as another Super Admin
    if (targetAdmin.role === 'SUPER_ADMIN' && targetAdmin._id.toString() !== req.admin._id.toString()) {
      return res.status(403).json({ message: 'Cannot login as another Super Admin' });
    }
    
    // Update last login time
    targetAdmin.lastLoginAt = new Date();
    await targetAdmin.save();
    
    res.json({
      _id: targetAdmin._id,
      username: targetAdmin.username,
      name: targetAdmin.name,
      email: targetAdmin.email,
      phone: targetAdmin.phone,
      role: targetAdmin.role,
      status: targetAdmin.status,
      adminCode: targetAdmin.adminCode,
      referralCode: targetAdmin.referralCode,
      referralUrl: targetAdmin.referralUrl,
      wallet: targetAdmin.wallet,
      charges: targetAdmin.charges,
      stats: targetAdmin.stats,
      isSuperAdminLogin: true,
      token: generateToken(targetAdmin._id),
      message: `Logged in as ${targetAdmin.role}: ${targetAdmin.name || targetAdmin.username}`
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create Admin (first time setup)
router.post('/setup', async (req, res) => {
  try {
    const adminExists = await Admin.findOne();
    if (adminExists) {
      return res.status(400).json({ message: 'Admin already exists' });
    }

    const { username, email, password, pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: 'PIN is required' });
    }

    const normalizedPin = pin.toString().trim();
    if (!/^\d{4,6}$/.test(normalizedPin)) {
      return res.status(400).json({ message: 'PIN must be a 4-6 digit number' });
    }

    const admin = await Admin.create({ username, email, password, pin: normalizedPin });

    res.status(201).json({
      _id: admin._id,
      username: admin.username,
      email: admin.email,
      role: admin.role,
      token: generateToken(admin._id)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current admin's data (refresh endpoint)
router.get('/me', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('-password -pin');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({
      _id: admin._id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      phone: admin.phone,
      role: admin.role,
      status: admin.status,
      adminCode: admin.adminCode,
      referralCode: admin.referralCode,
      wallet: admin.wallet,
      charges: admin.charges,
      stats: admin.stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all users (filtered by hierarchy for non-super admins)
router.get('/users', protectAdmin, async (req, res) => {
  try {
    let query = {};
    if (req.admin.role === 'SUPER_ADMIN') {
      // Super Admin sees all users
      query = {};
    } else {
      // ADMIN, BROKER, SUB_BROKER see users under them (direct + descendants)
      query = {
        $or: [
          { admin: req.admin._id },
          { hierarchyPath: req.admin._id }
        ]
      };
    }
    const users = await User.find(query)
      .select('-password')
      .populate('admin', 'name adminCode role')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single user
router.get('/users/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create user (All roles including SUPER_ADMIN can create users)
router.post('/users', protectAdmin, async (req, res) => {
  try {
    const { 
      username, email, password, fullName, phone, initialBalance,
      marginType, ledgerBalanceClosePercent, profitTradeHoldSeconds, lossTradeHoldSeconds,
      isActivated, isReadOnly, isDemo, intradaySquare, blockLimitAboveBelowHighLow, blockLimitBetweenHighLow
    } = req.body;
    
    if (!req.admin.adminCode) {
      return res.status(400).json({ message: 'Admin code missing on your profile. Contact Super Admin.' });
    }

    const userExists = await User.findOne({ $or: [{ email }, { username }] });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Build hierarchy path for the user
    const userHierarchyPath = [...(req.admin.hierarchyPath || []), req.admin._id];

    // Inherit segmentPermissions and scriptSettings from the creating admin
    // If admin has no settings, fallback to SystemSettings segmentDefaults
    let inheritedSegmentPermissions = {};
    let inheritedScriptSettings = {};
    
    const adminSegPerms = req.admin.segmentPermissions;
    if (adminSegPerms && ((adminSegPerms instanceof Map && adminSegPerms.size > 0) || Object.keys(adminSegPerms).length > 0)) {
      inheritedSegmentPermissions = adminSegPerms instanceof Map 
        ? Object.fromEntries(adminSegPerms) 
        : adminSegPerms;
    } else {
      // Fallback to SystemSettings adminSegmentDefaults (same structure as Admin.segmentPermissions)
      try {
        const sysSettings = await SystemSettings.getSettings();
        // Use adminSegmentDefaults first (exact same structure), fall back to old segmentDefaults mapping
        const asd = sysSettings?.adminSegmentDefaults;
        if (asd && ((asd instanceof Map && asd.size > 0) || Object.keys(asd).length > 0)) {
          inheritedSegmentPermissions = asd instanceof Map ? Object.fromEntries(asd) : { ...asd };
        }
        // Also inherit script defaults
        const assd = sysSettings?.adminScriptDefaults;
        if (assd && ((assd instanceof Map && assd.size > 0) || Object.keys(assd).length > 0)) {
          inheritedScriptSettings = assd instanceof Map ? Object.fromEntries(assd) : { ...assd };
        }
      } catch (e) {
        console.error('Failed to load SystemSettings fallback:', e.message);
      }
    }
    
    const adminScriptSettings = req.admin.scriptSettings;
    if (adminScriptSettings && ((adminScriptSettings instanceof Map && adminScriptSettings.size > 0) || Object.keys(adminScriptSettings).length > 0)) {
      inheritedScriptSettings = adminScriptSettings instanceof Map 
        ? Object.fromEntries(adminScriptSettings) 
        : adminScriptSettings;
    }

    const user = await User.create({
      username,
      email,
      password,
      fullName,
      phone,
      admin: req.admin._id,
      adminCode: req.admin.adminCode,
      creatorRole: req.admin.role,
      hierarchyPath: userHierarchyPath,
      createdBy: req.admin._id,
      wallet: {
        balance: initialBalance || 0,
        cashBalance: initialBalance || 0,
        blocked: 0
      },
      isActive: isActivated !== false,
      settings: {
        marginType: marginType || 'exposure',
        ledgerBalanceClosePercent: ledgerBalanceClosePercent || 90,
        profitTradeHoldSeconds: profitTradeHoldSeconds || 0,
        lossTradeHoldSeconds: lossTradeHoldSeconds || 0,
        isActivated: isActivated !== false,
        isReadOnly: isReadOnly || false,
        isDemo: isDemo || false,
        intradaySquare: intradaySquare || false,
        blockLimitAboveBelowHighLow: blockLimitAboveBelowHighLow || false,
        blockLimitBetweenHighLow: blockLimitBetweenHighLow || false
      },
      // Inherited from admin - no hardcoded defaults
      segmentPermissions: inheritedSegmentPermissions,
      scriptSettings: inheritedScriptSettings
    });

    res.status(201).json({
      _id: user._id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      adminCode: user.adminCode,
      creatorRole: user.creatorRole,
      wallet: user.wallet,
      isActive: user.isActive
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user
router.put('/users/:id', protectAdmin, async (req, res) => {
  try {
    const { username, email, fullName, phone, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.username = username || user.username;
    user.email = email || user.email;
    user.fullName = fullName || user.fullName;
    user.phone = phone || user.phone;
    user.isActive = isActive !== undefined ? isActive : user.isActive;

    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Save admin's own segment permissions and script settings
// These settings cascade to all users created under this admin
router.put('/my-settings', protectAdmin, async (req, res) => {
  try {
    const { segmentPermissions, scriptSettings } = req.body;
    
    const updateFields = {};
    if (segmentPermissions) {
      const plain =
        segmentPermissions instanceof Map ? Object.fromEntries(segmentPermissions) : segmentPermissions;
      updateFields.segmentPermissions = alignSegmentDefaultsMap(plain);
    }
    if (scriptSettings) {
      updateFields.scriptSettings = scriptSettings;
    }
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No settings provided' });
    }
    
    await Admin.updateOne({ _id: req.admin._id }, { $set: updateFields });
    
    const updatedAdmin = await Admin.findById(req.admin._id).select('segmentPermissions scriptSettings');
    res.json({ message: 'Admin settings saved successfully', settings: updatedAdmin });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get admin's own segment permissions and script settings
router.get('/my-settings', protectAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin._id).select('segmentPermissions scriptSettings');
    
    let segmentPermissions = admin.segmentPermissions;
    if (segmentPermissions && typeof segmentPermissions.toObject === 'function') {
      segmentPermissions = segmentPermissions.toObject();
    }
    
    let scriptSettings = admin.scriptSettings;
    if (scriptSettings && typeof scriptSettings.toObject === 'function') {
      scriptSettings = scriptSettings.toObject();
    }
    
    res.json({ segmentPermissions: segmentPermissions || {}, scriptSettings: scriptSettings || {} });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user segment and script settings
router.put('/users/:id/settings', protectAdmin, async (req, res) => {
  try {
    // Filter by adminCode for regular admins
    const query = req.admin.role === 'SUPER_ADMIN' 
      ? { _id: req.params.id } 
      : { _id: req.params.id, adminCode: req.admin.adminCode };
    
    const user = await User.findOne(query);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    const { segmentPermissions, scriptSettings } = req.body;
    
    const updateFields = {};
    if (segmentPermissions) {
      const plain =
        segmentPermissions instanceof Map ? Object.fromEntries(segmentPermissions) : segmentPermissions;
      updateFields.segmentPermissions = alignSegmentDefaultsMap(plain);
    }
    if (scriptSettings) {
      updateFields.scriptSettings = scriptSettings;
    }
    
    // Use updateOne to avoid segmentPermissions validation error
    await User.updateOne({ _id: user._id }, { $set: updateFields });
    
    const updatedUser = await User.findById(user._id).select('-password');
    res.json({ message: 'User settings updated successfully', user: updatedUser });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Change user password
router.put('/users/:id/password', protectAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user
router.delete('/users/:id', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Force logout user (Super Admin only) - Clear user's session token
router.post('/users/:id/force-logout', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can force logout users' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Clear the session token to force logout
    await User.updateOne(
      { _id: req.params.id },
      { $set: { activeSessionToken: null } }
    );

    res.json({ message: 'User has been logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Convert demo user to real account (Super Admin only)
router.post('/users/:id/convert-to-real', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can convert users to real accounts' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!user.isDemo) {
      return res.status(400).json({ message: 'User is already a real account' });
    }

    // Convert to real account and set the convertedAt date for 1-month first win calculation
    await User.updateOne(
      { _id: req.params.id },
      {
        $set: {
          isDemo: false,
          convertedToRealAt: new Date(),
          demoExpiresAt: null
        }
      }
    );

    res.json({ message: 'User converted to real account successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add funds to user wallet
router.post('/users/:id/wallet/deposit', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.wallet.balance += Number(amount);
    user.marginAvailable += Number(amount);
    user.wallet.transactions.push({
      type: 'deposit',
      amount: Number(amount),
      description: description || 'Deposit by admin',
      performedBy: req.admin._id
    });

    await user.save();
    res.json({ message: 'Funds added successfully', wallet: user.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Withdraw funds from user wallet
router.post('/users/:id/wallet/withdraw', protectAdmin, async (req, res) => {
  try {
    const { amount, description } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    user.wallet.balance -= Number(amount);
    user.marginAvailable -= Number(amount);
    user.wallet.transactions.push({
      type: 'withdraw',
      amount: Number(amount),
      description: description || 'Withdrawal by admin',
      performedBy: req.admin._id
    });

    await user.save();
    res.json({ message: 'Funds withdrawn successfully', wallet: user.wallet });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user wallet transactions
router.get('/users/:id/wallet', protectAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('wallet marginAvailable');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ============ BANK MANAGEMENT (Super Admin Only) ============

// Get bank settings
router.get('/bank-settings', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can access bank settings' });
    }
    const settings = await BankSettings.getSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bank settings
router.put('/bank-settings', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update bank settings' });
    }
    
    let settings = await BankSettings.findOne();
    if (!settings) {
      settings = new BankSettings();
    }
    
    const { minimumDeposit, maximumDeposit, minimumWithdrawal, maximumWithdrawal, 
            withdrawalProcessingTime, depositInstructions, withdrawalInstructions } = req.body;
    
    if (minimumDeposit !== undefined) settings.minimumDeposit = minimumDeposit;
    if (maximumDeposit !== undefined) settings.maximumDeposit = maximumDeposit;
    if (minimumWithdrawal !== undefined) settings.minimumWithdrawal = minimumWithdrawal;
    if (maximumWithdrawal !== undefined) settings.maximumWithdrawal = maximumWithdrawal;
    if (withdrawalProcessingTime) settings.withdrawalProcessingTime = withdrawalProcessingTime;
    if (depositInstructions) settings.depositInstructions = depositInstructions;
    if (withdrawalInstructions) settings.withdrawalInstructions = withdrawalInstructions;
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add bank account
router.post('/bank-settings/bank-account', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can add bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const { bankName, accountName, accountNumber, ifscCode, branch, isPrimary } = req.body;
    
    if (!bankName || !accountName || !accountNumber || !ifscCode) {
      return res.status(400).json({ message: 'All bank details are required' });
    }
    
    // If this is set as primary, unset others
    if (isPrimary) {
      settings.bankAccounts.forEach(acc => acc.isPrimary = false);
    }
    
    settings.bankAccounts.push({
      bankName,
      accountName,
      accountNumber,
      ifscCode,
      branch,
      isPrimary: isPrimary || settings.bankAccounts.length === 0,
      isActive: true
    });
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update bank account
router.put('/bank-settings/bank-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const account = settings.bankAccounts.id(req.params.id);
    
    if (!account) {
      return res.status(404).json({ message: 'Bank account not found' });
    }
    
    const { bankName, accountName, accountNumber, ifscCode, branch, isActive, isPrimary } = req.body;
    
    if (bankName) account.bankName = bankName;
    if (accountName) account.accountName = accountName;
    if (accountNumber) account.accountNumber = accountNumber;
    if (ifscCode) account.ifscCode = ifscCode;
    if (branch !== undefined) account.branch = branch;
    if (isActive !== undefined) account.isActive = isActive;
    
    if (isPrimary) {
      settings.bankAccounts.forEach(acc => acc.isPrimary = false);
      account.isPrimary = true;
    }
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete bank account
router.delete('/bank-settings/bank-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete bank accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    settings.bankAccounts.pull(req.params.id);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add UPI account
router.post('/bank-settings/upi-account', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can add UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const { upiId, name, provider, isPrimary } = req.body;
    
    if (!upiId || !name) {
      return res.status(400).json({ message: 'UPI ID and name are required' });
    }
    
    // If this is set as primary, unset others
    if (isPrimary) {
      settings.upiAccounts.forEach(acc => acc.isPrimary = false);
    }
    
    settings.upiAccounts.push({
      upiId,
      name,
      provider: provider || 'other',
      isPrimary: isPrimary || settings.upiAccounts.length === 0,
      isActive: true
    });
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update UPI account
router.put('/bank-settings/upi-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can update UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    const account = settings.upiAccounts.id(req.params.id);
    
    if (!account) {
      return res.status(404).json({ message: 'UPI account not found' });
    }
    
    const { upiId, name, provider, isActive, isPrimary } = req.body;
    
    if (upiId) account.upiId = upiId;
    if (name) account.name = name;
    if (provider) account.provider = provider;
    if (isActive !== undefined) account.isActive = isActive;
    
    if (isPrimary) {
      settings.upiAccounts.forEach(acc => acc.isPrimary = false);
      account.isPrimary = true;
    }
    
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete UPI account
router.delete('/bank-settings/upi-account/:id', protectAdmin, async (req, res) => {
  try {
    if (req.admin.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ message: 'Only Super Admin can delete UPI accounts' });
    }
    
    const settings = await BankSettings.getSettings();
    settings.upiAccounts.pull(req.params.id);
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Transfer funds to another admin
router.post('/transfer-to-admin', protectAdmin, async (req, res) => {
  try {
    const { targetAdminId, amount, description } = req.body;

    if (!targetAdminId || !amount) {
      return res.status(400).json({ message: 'Target admin ID and amount are required' });
    }

    if (Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    // Get current admin
    const currentAdmin = await Admin.findById(req.admin._id);
    if (!currentAdmin) {
      return res.status(404).json({ message: 'Admin not found' });
    }

    // Check if current admin has enough balance
    if (currentAdmin.wallet.balance < Number(amount)) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Get target admin
    const targetAdmin = await Admin.findById(targetAdminId);
    if (!targetAdmin) {
      return res.status(404).json({ message: 'Target admin not found' });
    }

    // Check if target admin is same as current admin
    if (targetAdmin._id.toString() === currentAdmin._id.toString()) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Perform the transfer
    currentAdmin.wallet.balance -= Number(amount);
    targetAdmin.wallet.balance += Number(amount);

    await currentAdmin.save();
    await targetAdmin.save();

    res.json({
      message: 'Transfer successful',
      currentWallet: currentAdmin.wallet,
      targetWallet: targetAdmin.wallet
    });
  } catch (error) {
    console.error('Error transferring funds:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get list of admins for transfer
router.get('/admins-list', protectAdmin, async (req, res) => {
  try {
    const admins = await Admin.find({
      _id: { $ne: req.admin._id },
      role: 'ADMIN'
    })
    .select('name username role adminCode wallet.balance')
    .lean();

    res.json({ admins });
  } catch (error) {
    console.error('Error fetching admins list:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
