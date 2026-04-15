/**
 * Admin Authentication Middleware
 * Handles JWT validation and role-based access control for admin routes
 */

import jwt from 'jsonwebtoken';
import Admin from '../models/Admin.js';

// ============================================================================
// JWT TOKEN GENERATION
// ============================================================================

/**
 * Generate JWT token for admin authentication
 * @param {string} id - Admin ID
 * @returns {string} JWT token
 */
export const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Protect admin routes - validates JWT token and admin status
 */
export const protectAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'Not authorized - No token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = await Admin.findById(decoded.id).select('-password');
    
    if (!req.admin) {
      return res.status(401).json({ message: 'Admin not found' });
    }
    
    if (req.admin.status !== 'ACTIVE') {
      return res.status(401).json({ message: 'Account suspended' });
    }
    
    next();
  } catch (error) {
    res.status(401).json({ message: 'Not authorized - Invalid token' });
  }
};

// ============================================================================
// ROLE-BASED ACCESS MIDDLEWARE
// ============================================================================

/**
 * Super Admin only access
 */
export const superAdminOnly = (req, res, next) => {
  if (req.admin.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ message: 'Super Admin access required' });
  }
  next();
};

/**
 * Admin or higher access (SUPER_ADMIN, ADMIN)
 */
export const adminOrHigher = (req, res, next) => {
  if (!['SUPER_ADMIN', 'ADMIN'].includes(req.admin.role)) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

/**
 * Broker or higher access (SUPER_ADMIN, ADMIN, BROKER)
 */
export const brokerOrHigher = (req, res, next) => {
  if (!['SUPER_ADMIN', 'ADMIN', 'BROKER'].includes(req.admin.role)) {
    return res.status(403).json({ message: 'Broker access required' });
  }
  next();
};

// ============================================================================
// HIERARCHY HELPERS
// ============================================================================

/**
 * Role hierarchy levels (lower number = higher authority)
 */
export const HIERARCHY_LEVELS = {
  'SUPER_ADMIN': 0,
  'ADMIN': 1,
  'BROKER': 2,
  'SUB_BROKER': 3
};

/**
 * Get allowed child roles that a role can create
 * @param {string} role - Current admin role
 * @returns {string[]} Array of roles that can be created
 */
export const getAllowedChildRoles = (role) => {
  const childRoles = {
    'SUPER_ADMIN': ['ADMIN', 'BROKER', 'SUB_BROKER'],
    'ADMIN': ['BROKER', 'SUB_BROKER'],
    'BROKER': ['SUB_BROKER'],
    'SUB_BROKER': []
  };
  return childRoles[role] || [];
};

/**
 * Check if requester can manage target role
 * @param {string} requesterRole - Role of the requester
 * @param {string} targetRole - Role to be managed
 * @returns {boolean}
 */
export const canManageRole = (requesterRole, targetRole) => {
  return HIERARCHY_LEVELS[requesterRole] < HIERARCHY_LEVELS[targetRole];
};

/**
 * Apply hierarchy filter - users see only their own and descendants
 * @param {object} req - Express request object
 * @param {object} query - MongoDB query object
 * @returns {object} Modified query
 */
export const applyHierarchyFilter = (req, query = {}) => {
  if (req.admin.role === 'SUPER_ADMIN') {
    return query; // Super Admin sees all
  }
  query.$or = [
    { admin: req.admin._id },
    { hierarchyPath: req.admin._id }
  ];
  return query;
};

/**
 * Apply adminCode filter for non-super admins
 * @param {object} req - Express request object
 * @param {object} query - MongoDB query object
 * @returns {object} Modified query
 */
export const applyAdminFilter = (req, query = {}) => {
  if (req.admin.role === 'SUPER_ADMIN') {
    return query;
  }
  query.$or = [
    { adminCode: req.admin.adminCode },
    { hierarchyPath: req.admin._id }
  ];
  return query;
};

export default {
  generateToken,
  protectAdmin,
  superAdminOnly,
  adminOrHigher,
  brokerOrHigher,
  HIERARCHY_LEVELS,
  getAllowedChildRoles,
  canManageRole,
  applyHierarchyFilter,
  applyAdminFilter
};
