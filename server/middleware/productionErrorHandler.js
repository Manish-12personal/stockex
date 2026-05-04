/**
 * Production Error Handler
 * 
 * Prevents server crashes with comprehensive error handling.
 * Catches all unhandled errors and responds gracefully.
 */

import { ZerodhaController } from '../controllers/zerodhaController.js';

// Global error handler for uncaught exceptions
process.on('uncaughtException', (error, origin) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  console.error('Origin:', origin);
  // Don't exit the process, just log and continue
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('UNHANDLED REJECTION:', reason);
  console.error('Promise:', promise);
  // Don't exit the process, just log and continue
});

/**
 * Production error handler middleware
 */
export const productionErrorHandler = (err, req, res, next) => {
  try {
    console.error('Production Error Handler:', err);
    
    // Log the error details
    const errorInfo = {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      timestamp: new Date().toISOString(),
      userAgent: req.get('User-Agent'),
      ip: req.ip || req.connection.remoteAddress
    };
    
    console.error('Error Details:', JSON.stringify(errorInfo, null, 2));
    
    // Don't send stack trace to client in production
    const clientResponse = {
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
      timestamp: new Date().toISOString()
    };
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        ...clientResponse,
        message: 'Validation error',
        error: err.message
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        ...clientResponse,
        message: 'Invalid data format',
        error: 'Invalid ID format'
      });
    }
    
    if (err.code === 11000) {
      return res.status(409).json({
        ...clientResponse,
        message: 'Duplicate data',
        error: 'Data already exists'
      });
    }
    
    if (err.message && err.message.includes('not authorized')) {
      return res.status(401).json({
        ...clientResponse,
        message: 'Authentication required',
        error: err.message
      });
    }
    
    if (err.message && err.message.includes('not found')) {
      return res.status(404).json({
        ...clientResponse,
        message: 'Resource not found',
        error: err.message
      });
    }
    
    // Default 500 error
    res.status(500).json(clientResponse);
    
  } catch (handlerError) {
    console.error('Error in error handler:', handlerError);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: 'Something went wrong'
    });
  }
};

/**
 * Safe route handler wrapper
 */
export const safeHandler = (handler) => {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error('Safe Handler Error:', error);
      
      // Check if it's a Zerodha controller error
      if (error.message && error.message.includes('orchestrator')) {
        return res.status(500).json({
          success: false,
          message: 'Zerodha service unavailable',
          error: 'Service temporarily unavailable',
          connected: false,
          initialized: false
        });
      }
      
      // Handle other errors
      if (error.name === 'TypeError' && error.message.includes('undefined')) {
        return res.status(500).json({
          success: false,
          message: 'Service initialization error',
          error: 'Service not properly initialized',
          connected: false,
          initialized: false
        });
      }
      
      next(error);
    }
  };
};

/**
 * Initialize safe Zerodha controller
 */
let zerodhaControllerInstance = null;

export const getZerodhaController = () => {
  if (!zerodhaControllerInstance) {
    try {
      zerodhaControllerInstance = new ZerodhaController();
      console.log('Zerodha controller initialized safely');
    } catch (error) {
      console.error('Failed to initialize Zerodha controller:', error);
      // Return a mock controller that won't crash
      zerodhaControllerInstance = {
        getStatus: async (req, res) => {
          res.json({
            connected: false,
            initialized: false,
            error: 'Zerodha service not available'
          });
        },
        getLoginUrl: async (req, res) => {
          res.status(500).json({
            message: 'Zerodha service not available',
            error: 'Service not initialized'
          });
        },
        connect: async (req, res) => {
          res.status(500).json({
            message: 'Zerodha service not available',
            error: 'Service not initialized'
          });
        },
        disconnect: async (req, res) => {
          res.status(500).json({
            message: 'Zerodha service not available',
            error: 'Service not initialized'
          });
        }
      };
    }
  }
  return zerodhaControllerInstance;
};
