/**
 * Zerodha Routes - Clean MVC Structure
 * 
 * FIXED: Prevents 504 errors with proper timeout management and background job processing.
 * Clean separation of concerns - Routes only handle HTTP, business logic in controllers.
 */

import express from 'express';
import { 
  protectAdmin, 
  protectUser, 
  superAdminOnly,
  optionalAuth 
} from '../middleware/authMiddleware.js';
import {
  requireZerodhaConnection,
  requireZerodhaSession,
  validateTokensArray,
  validateJobId,
  rateLimitZerodha,
  addZerodhaContext,
  handleZerodhaErrors,
  validateSyncOperation
} from '../middleware/zerodhaMiddleware.js';
import zerodhaController from '../controllers/zerodhaController.js';

const router = express.Router();

/**
 * Set Socket.IO instance for controller
 */
export const setSocketIO = (socketIO) => {
  zerodhaController.initialize(socketIO);
};

/**
 * Apply global middleware
 */
router.use(addZerodhaContext);
router.use(handleZerodhaErrors);

/**
 * Connection Management Routes
 */

// Connect to Zerodha
router.post('/connect', 
  protectAdmin, 
  superAdminOnly, 
  rateLimitZerodha(5, 60000), // 5 attempts per minute
  zerodhaController.connect
);

// Disconnect from Zerodha
router.post('/disconnect', 
  protectAdmin, 
  superAdminOnly, 
  zerodhaController.disconnect
);

// Get connection status (optional auth - works with or without token)
router.get('/status', 
  optionalAuth,  // ✅ Works with or without authentication
  zerodhaController.getStatus
);

// Get session info
router.get('/session', 
  protectAdmin, 
  zerodhaController.getSession
);

/**
 * Synchronization Routes
 */

// Reset and sync instruments (FIXED: prevents 504 errors)
router.post('/reset-and-sync', 
  protectAdmin, 
  superAdminOnly,
  requireZerodhaSession,
  validateSyncOperation,
  rateLimitZerodha(2, 300000), // 2 attempts per 5 minutes
  zerodhaController.resetAndSync
);

// Get sync job status
router.get('/sync/status/:jobId', 
  protectAdmin, 
  superAdminOnly,
  validateJobId,
  zerodhaController.getSyncStatus
);

// Get all sync jobs
router.get('/sync/jobs', 
  protectAdmin, 
  superAdminOnly,
  zerodhaController.getSyncJobs
);

// Cancel sync job
router.post('/sync/cancel/:jobId', 
  protectAdmin, 
  superAdminOnly,
  validateJobId,
  zerodhaController.cancelSyncJob
);

/**
 * Subscription Management Routes
 */

// Subscribe to tokens
router.post('/subscribe', 
  protectAdmin, 
  requireZerodhaConnection,
  validateTokensArray,
  rateLimitZerodha(10, 60000), // 10 attempts per minute
  zerodhaController.subscribeTokens
);

// Unsubscribe from tokens
router.post('/unsubscribe', 
  protectAdmin, 
  requireZerodhaConnection,
  validateTokensArray,
  rateLimitZerodha(10, 60000), // 10 attempts per minute
  zerodhaController.unsubscribeTokens
);

// Get subscription statistics
router.get('/subscriptions', 
  protectAdmin, 
  requireZerodhaConnection,
  zerodhaController.getSubscriptions
);

/**
 * Market Data Routes
 */

// Get market data
router.get('/market-data', 
  protectUser, 
  requireZerodhaConnection,
  rateLimitZerodha(100, 60000), // 100 requests per minute for users
  zerodhaController.getMarketData
);

/**
 * Health and Maintenance Routes
 */

// Health check endpoint
router.get('/health', 
  protectAdmin, 
  zerodhaController.healthCheck
);

// Cleanup old jobs
router.post('/cleanup', 
  protectAdmin, 
  superAdminOnly,
  rateLimitZerodha(5, 300000), // 5 attempts per 5 minutes
  zerodhaController.cleanupJobs
);

export default router;
