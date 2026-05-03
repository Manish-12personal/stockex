import express from 'express';
import { protectAdmin, superAdminOnly } from '../middleware/auth.js';
import { 
  getBrokerageRestriction, 
  updateBrokerageRestriction 
} from '../controllers/brokerageRestrictionController.js';

const router = express.Router();

/**
 * GET /api/admins/:id/brokerage-restriction
 * Get brokerage restriction settings for an admin (Super Admin only)
 */
router.get('/admins/:id/brokerage-restriction', protectAdmin, superAdminOnly, getBrokerageRestriction);

/**
 * PUT /api/admins/:id/brokerage-restriction
 * Update brokerage restriction settings for an admin (Super Admin only)
 */
router.put('/admins/:id/brokerage-restriction', protectAdmin, superAdminOnly, updateBrokerageRestriction);

export default router;
