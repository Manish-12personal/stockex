/**
 * Zerodha Controller
 * 
 * Handles all Zerodha-related operations with proper separation of concerns.
 * Follows SOLID principles and clean architecture.
 */

import { ZerodhaOrchestrator } from '../services/zerodha/ZerodhaOrchestrator.js';
import { ZerodhaConnectionManager } from '../services/zerodha/ZerodhaConnectionManager.js';
import { ZerodhaSubscriptionManager } from '../services/zerodha/ZerodhaSubscriptionManager.js';
import { ZerodhaSyncService } from '../services/zerodha/ZerodhaSyncService.js';
import { ZerodhaProgressService } from '../services/zerodha/ZerodhaProgressService.js';

// Logger service
class Logger {
  info(message, data) {
    console.log(`[ZerodhaController] ${message}`, data || '');
  }
  
  warn(message, data) {
    console.warn(`[ZerodhaController] ${message}`, data || '');
  }
  
  error(message, data) {
    console.error(`[ZerodhaController] ${message}`, data || '');
  }
  
  debug(message, data) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[ZerodhaController] ${message}`, data || '');
    }
  }
}

// Config service
class Config {
  getConnectionTimeout() {
    return parseInt(process.env.ZERODHA_CONNECTION_TIMEOUT || '30000');
  }
  
  getSyncTimeout() {
    return parseInt(process.env.ZERODHA_SYNC_TIMEOUT || '300000');
  }
  
  getMaxRetries() {
    return parseInt(process.env.ZERODHA_MAX_RETRIES || '3');
  }
}

class ZerodhaController {
  constructor() {
    this.logger = new Logger();
    this.config = new Config();
    this.orchestrator = null;
    this.io = null;
    this.session = {
      apiKey: null,
      accessToken: null,
      userId: null,
      loginTime: null
    };
    this.sessionFile = null;
  }

  /**
   * Initialize controller with Socket.IO instance
   */
  async initialize(socketIO) {
    try {
      this.io = socketIO;
      this.sessionFile = new URL('../.zerodha-session.json', import.meta.url);
      
      // Initialize services
      const progressService = new ZerodhaProgressService(this.logger);
      const connectionManager = new ZerodhaConnectionManager(this.config, this.logger);
      const subscriptionManager = new ZerodhaSubscriptionManager(connectionManager, this.config, this.logger);
      const syncService = new ZerodhaSyncService(this.config, this.logger, progressService);
      
      this.orchestrator = new ZerodhaOrchestrator(
        connectionManager,
        subscriptionManager,
        syncService,
        progressService,
        this.config,
        this.logger
      );

      // Simple initialization without complex setup
      if (this.orchestrator) {
        this.orchestrator.isInitialized = true;
      }
      
      // Load existing session
      await this.loadSession();
      
      this.logger.info('Zerodha controller initialized successfully');
      
    } catch (error) {
      this.logger.error('Failed to initialize Zerodha controller:', error);
      // Don't throw error, just log it to prevent server crash
      console.error('Zerodha controller initialization failed, continuing without Zerodha:', error.message);
    }
  }

  /**
   * Get Zerodha login URL
   */
  async getLoginUrl(req, res) {
    try {
      const apiKey = process.env.ZERODHA_API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({
          message: 'Zerodha API key not configured',
          error: 'ZERODHA_API_KEY environment variable not set'
        });
      }

      const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
      
      res.json({
        loginUrl,
        apiKey: apiKey.substring(0, 8) + '...', // Partial API key for reference
        message: 'Use this URL to connect to Zerodha'
      });
      
    } catch (error) {
      this.logger.error('Error generating login URL:', error);
      res.status(500).json({
        message: 'Failed to generate login URL',
        error: error.message
      });
    }
  }

  /**
   * Connect to Zerodha
   */
  async connect(req, res) {
    try {
      const { apiKey, accessToken, userId } = req.body;
      
      if (!apiKey || !accessToken) {
        return res.status(400).json({ 
          message: 'API key and access token are required' 
        });
      }

      if (this.logger) {
        this.logger.info('Connecting to Zerodha...', { userId });
      } else {
        console.log('Connecting to Zerodha...', { userId });
      }

      // Save session
      this.session = { apiKey, accessToken, userId, loginTime: new Date() };
      await this.saveSession();

      // Check if orchestrator is available
      if (!this.orchestrator) {
        return res.status(500).json({
          message: 'Zerodha orchestrator not initialized',
          error: 'Service not available'
        });
      }

      // Connect with timeout
      const ticker = await this.orchestrator.connect(apiKey, accessToken, {
        timeout: this.config ? this.config.getConnectionTimeout() : 30000
      });

      res.json({
        message: 'Connected to Zerodha successfully',
        status: this.orchestrator.getConnectionStatus()
      });

    } catch (error) {
      if (this.logger) {
        this.logger.error('Connection failed:', error);
      } else {
        console.error('Zerodha connection failed:', error);
      }
      
      // Clear session on connection failure
      await this.clearSession();
      
      res.status(500).json({
        message: 'Failed to connect to Zerodha',
        error: error.message
      });
    }
  }

  /**
   * Disconnect from Zerodha
   */
  async disconnect(req, res) {
    try {
      await this.orchestrator.disconnect();
      await this.clearSession();

      res.json({ message: 'Disconnected from Zerodha successfully' });

    } catch (error) {
      this.logger.error('Disconnect failed:', error);
      res.status(500).json({
        message: 'Failed to disconnect from Zerodha',
        error: error.message
      });
    }
  }

  /**
   * Get connection status (works with or without authentication)
   */
  async getStatus(req, res) {
    try {
      // Add null check for orchestrator
      if (!this.orchestrator) {
        return res.json({
          connected: false,
          initialized: false,
          authenticated: !!req.user,
          userType: req.userType || null,
          timestamp: new Date(),
          error: 'Zerodha orchestrator not initialized'
        });
      }

      const status = this.orchestrator.getConnectionStatus();
      
      // Add user context if authenticated
      const response = {
        ...status,
        authenticated: !!req.user,
        userType: req.userType || null,
        timestamp: new Date()
      };
      
      res.json(response);
    } catch (error) {
      // Use console.log as fallback if logger is not available
      if (this.logger) {
        this.logger.error('Error getting status:', error);
      } else {
        console.error('Zerodha status error:', error);
      }
      
      res.status(500).json({
        message: 'Failed to get connection status',
        error: error.message,
        authenticated: !!req.user,
        userType: req.userType || null
      });
    }
  }

  /**
   * Reset and sync instruments
   */
  async resetAndSync(req, res) {
    try {
      if (!this.session.accessToken) {
        return res.status(401).json({ 
          message: 'Not logged in to Zerodha. Please connect first.' 
        });
      }

      // Check if sync is already running
      const runningJobs = this.orchestrator.progressService.getRunningJobs()
        .filter(job => job.type === 'full_sync');
      
      if (runningJobs.length > 0) {
        return res.status(409).json({
          message: 'Sync is already running',
          job: runningJobs[0],
          statusUrl: `/api/zerodha/sync/status/${runningJobs[0].id}`
        });
      }

      // Start sync in background
      const result = await this.orchestrator.performSync(
        this.session.apiKey,
        this.session.accessToken,
        {
          timeout: this.config.getSyncTimeout(),
          maxRetries: this.config.getMaxRetries()
        }
      );

      res.status(202).json({
        message: 'Sync started in background',
        jobId: result.jobId,
        statusUrl: `/api/zerodha/sync/status/${result.jobId}`,
        estimatedTime: '5-10 minutes'
      });

    } catch (error) {
      this.logger.error('Failed to start sync:', error);
      res.status(500).json({
        message: 'Failed to start synchronization',
        error: error.message
      });
    }
  }

  /**
   * Get sync job status
   */
  async getSyncStatus(req, res) {
    try {
      const { jobId } = req.params;
      const job = this.orchestrator.progressService.getJob(jobId);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json(job);

    } catch (error) {
      this.logger.error('Error getting sync status:', error);
      res.status(500).json({
        message: 'Failed to get sync status',
        error: error.message
      });
    }
  }

  /**
   * Get all sync jobs
   */
  async getSyncJobs(req, res) {
    try {
      const jobs = this.orchestrator.progressService.getJobsByType('full_sync');
      res.json({ jobs });
    } catch (error) {
      this.logger.error('Error getting sync jobs:', error);
      res.status(500).json({
        message: 'Failed to get sync jobs',
        error: error.message
      });
    }
  }

  /**
   * Cancel sync job
   */
  async cancelSyncJob(req, res) {
    try {
      const { jobId } = req.params;
      const job = this.orchestrator.progressService.cancelJob(jobId, 'Cancelled by user');
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      res.json({
        message: 'Job cancelled successfully',
        job
      });

    } catch (error) {
      this.logger.error('Error cancelling sync job:', error);
      res.status(500).json({
        message: 'Failed to cancel sync job',
        error: error.message
      });
    }
  }

  /**
   * Subscribe to tokens
   */
  async subscribeTokens(req, res) {
    try {
      const { tokens } = req.body;
      
      if (!Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ message: 'Tokens array is required' });
      }

      if (!this.orchestrator.getConnectionStatus().connected) {
        return res.status(400).json({ message: 'Not connected to Zerodha' });
      }

      const result = await this.orchestrator.subscribeTokens(tokens, {
        timeout: 30000 // 30 seconds timeout
      });

      res.json({
        message: 'Subscription request processed',
        result
      });

    } catch (error) {
      this.logger.error('Error subscribing to tokens:', error);
      res.status(500).json({
        message: 'Failed to subscribe to tokens',
        error: error.message
      });
    }
  }

  /**
   * Unsubscribe from tokens
   */
  async unsubscribeTokens(req, res) {
    try {
      const { tokens } = req.body;
      
      if (!Array.isArray(tokens) || tokens.length === 0) {
        return res.status(400).json({ message: 'Tokens array is required' });
      }

      const result = await this.orchestrator.unsubscribeTokens(tokens);

      res.json({
        message: 'Unsubscription request processed',
        result
      });

    } catch (error) {
      this.logger.error('Error unsubscribing from tokens:', error);
      res.status(500).json({
        message: 'Failed to unsubscribe from tokens',
        error: error.message
      });
    }
  }

  /**
   * Get market data
   */
  async getMarketData(req, res) {
    try {
      const marketData = this.orchestrator.getMarketData();
      res.json({ marketData });
    } catch (error) {
      this.logger.error('Error getting market data:', error);
      res.status(500).json({
        message: 'Failed to get market data',
        error: error.message
      });
    }
  }

  /**
   * Health check
   */
  async healthCheck(req, res) {
    try {
      const health = await this.orchestrator.performHealthCheck();
      
      res.status(health.overall ? 200 : 503).json({
        status: health.overall ? 'healthy' : 'unhealthy',
        health
      });

    } catch (error) {
      this.logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'unhealthy',
        error: error.message
      });
    }
  }

  /**
   * Get subscription statistics
   */
  async getSubscriptions(req, res) {
    try {
      const stats = this.orchestrator.getConnectionStatus().subscriptions;
      res.json({ subscriptions: stats });
    } catch (error) {
      this.logger.error('Error getting subscription stats:', error);
      res.status(500).json({
        message: 'Failed to get subscription statistics',
        error: error.message
      });
    }
  }

  /**
   * Cleanup old jobs
   */
  async cleanupJobs(req, res) {
    try {
      const cleanedCount = this.orchestrator.progressService.cleanupAllJobs();
      res.json({
        message: 'Cleanup completed',
        cleanedJobs: cleanedCount
      });
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
      res.status(500).json({
        message: 'Failed to cleanup jobs',
        error: error.message
      });
    }
  }

  /**
   * Get session info
   */
  async getSession(req, res) {
    try {
      res.json({
        hasSession: !!this.session.accessToken,
        userId: this.session.userId,
        loginTime: this.session.loginTime
      });
    } catch (error) {
      this.logger.error('Error getting session info:', error);
      res.status(500).json({
        message: 'Failed to get session info',
        error: error.message
      });
    }
  }

  /**
   * Session management methods
   */
  async loadSession() {
    try {
      if (this.sessionFile) {
        const fs = await import('fs/promises');
        try {
          const data = await fs.readFile(this.sessionFile, 'utf8');
          this.session = JSON.parse(data);
          this.logger.info('Session loaded from file');
        } catch (error) {
          // File doesn't exist or is invalid
          this.logger.debug('No existing session file found');
        }
      }
    } catch (error) {
      this.logger.error('Error loading session:', error);
    }
  }

  async saveSession() {
    try {
      if (this.sessionFile) {
        const fs = await import('fs/promises');
        await fs.writeFile(this.sessionFile, JSON.stringify(this.session, null, 2));
        this.logger.info('Session saved to file');
      }
    } catch (error) {
      this.logger.error('Error saving session:', error);
    }
  }

  async clearSession() {
    this.session = {
      apiKey: null,
      accessToken: null,
      userId: null,
      loginTime: null
    };
    
    try {
      if (this.sessionFile) {
        const fs = await import('fs/promises');
        await fs.writeFile(this.sessionFile, JSON.stringify(this.session, null, 2));
      }
    } catch (error) {
      this.logger.error('Error clearing session:', error);
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    try {
      this.logger.info('Cleaning up Zerodha controller...');
      
      if (this.orchestrator) {
        await this.orchestrator.cleanup();
      }
      
      this.logger.info('Zerodha controller cleaned up successfully');
      
    } catch (error) {
      this.logger.error('Error during cleanup:', error);
    }
  }
}

// Singleton instance
const zerodhaController = new ZerodhaController();

export default zerodhaController;
