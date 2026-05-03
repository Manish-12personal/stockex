/**
 * [Route Name] Routes Template
 * 
 * Clean architecture template for route implementation.
 * Copy this template to create new route files with consistent structure.
 * 
 * Route Groups:
 * 1. [Group 1] - [Description]
 * 2. [Group 2] - [Description]
 * 3. [Group 3] - [Description]
 */

import express from 'express';
import { protectAdmin, protectUser, superAdminOnly } from '../middleware/auth.js';
import {
  // Import controller functions here
} from '../controllers/[controllerName].js';

const router = express.Router();

// ==================== MIDDLEWARE COMPOSITION ====================

/**
 * Authentication middleware combinations
 * Define reusable middleware arrays for different access levels
 */
const superAdminAuth = [protectAdmin, superAdminOnly];
const adminAuth = [protectAdmin];
const userAuth = [protectUser];

// ==================== [GROUP 1] ROUTES ====================

/**
 * @route   [METHOD] /api/[route-path]
 * @desc    [Description of what the route does]
 * @access  [Access level - Super Admin only, Admin, User, Public]
 * @param   [Parameter description]
 * @query   [Query parameter description]
 * @body    [Request body description]
 * @returns [Response description]
 * 
 * Example: [Example request/response]
 * 
 * Use Case: [When to use this route]
 */
router.get('[path]', ...[middleware], [controllerFunction]);

// ==================== [GROUP 2] ROUTES ====================

// Add more routes following the same pattern

// ==================== [GROUP 3] ROUTES ====================

// Add more routes following the same pattern

// ==================== EXPORT ====================

export default router;
