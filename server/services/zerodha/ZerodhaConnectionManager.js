/**
 * Zerodha Connection Manager
 * 
 * Manages Zerodha WebSocket connections with proper error handling and timeout management.
 * Follows SOLID principles with single responsibility for connection management.
 */

import { KiteTicker } from 'kiteconnect';

export class ZerodhaConnectionManager {
  constructor(configService, loggerService) {
    this.configService = configService;
    this.loggerService = loggerService;
    this.ticker = null;
    this.connectionState = {
      isConnected: false,
      isConnecting: false,
      reconnectAttempts: 0,
      lastError: null,
      lastConnectedAt: null
    };
    this.eventHandlers = new Map();
    this.reconnectConfig = {
      maxAttempts: 1000,
      interval: 5000,
      backoffMultiplier: 1.5,
      maxInterval: 30000
    };
  }

  /**
   * Connect to Zerodha WebSocket with timeout and error handling
   */
  async connect(apiKey, accessToken, options = {}) {
    try {
      if (this.connectionState.isConnecting) {
        throw new Error('Connection already in progress');
      }

      if (this.connectionState.isConnected) {
        await this.disconnect();
      }

      this.connectionState.isConnecting = true;
      this.connectionState.reconnectAttempts = 0;

      const connectPromise = new Promise((resolve, reject) => {
        const timeout = options.timeout || this.configService.getConnectionTimeout();
        const timeoutId = setTimeout(() => {
          reject(new Error(`Connection timeout after ${timeout}ms`));
        }, timeout);

        this.ticker = new KiteTicker({
          api_key: apiKey,
          access_token: accessToken
        });

        this.setupEventHandlers(resolve, reject, timeoutId);
        this.ticker.connect();
      });

      await connectPromise;
      
      this.connectionState.isConnected = true;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = new Date();
      this.connectionState.reconnectAttempts = 0;
      this.connectionState.lastError = null;

      this.loggerService.info('Zerodha WebSocket connected successfully');
      this.emit('connected', { timestamp: this.connectionState.lastConnectedAt });

      return this.ticker;

    } catch (error) {
      this.connectionState.isConnecting = false;
      this.connectionState.lastError = error;
      this.loggerService.error('Zerodha connection failed:', error);
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Setup event handlers for WebSocket events
   */
  setupEventHandlers(resolve, reject, timeoutId) {
    // Connection success
    this.ticker.on('connect', () => {
      clearTimeout(timeoutId);
      resolve(this.ticker);
    });

    // Connection error
    this.ticker.on('error', (error) => {
      clearTimeout(timeoutId);
      this.connectionState.lastError = error;
      
      if (String(error?.message || error).includes('403')) {
        this.loggerService.error('Zerodha WebSocket 403: Access token expired or invalid');
        this.emit('auth_error', error);
      } else {
        this.loggerService.error('Zerodha WebSocket error:', error);
        this.emit('error', error);
      }
      
      if (this.connectionState.isConnecting) {
        reject(error);
      }
    });

    // Disconnection
    this.ticker.on('disconnect', () => {
      this.connectionState.isConnected = false;
      this.loggerService.warn('Zerodha WebSocket disconnected');
      this.emit('disconnected', { timestamp: new Date() });
    });

    // Reconnection
    this.ticker.on('reconnect', (reconnectCount, reconnectInterval) => {
      this.connectionState.reconnectAttempts = reconnectCount;
      this.loggerService.info(`Zerodha WebSocket reconnecting: attempt ${reconnectCount}, interval ${reconnectInterval}s`);
      this.emit('reconnecting', { attempt: reconnectCount, interval: reconnectInterval });
    });

    // Max reconnection attempts
    this.ticker.on('noreconnect', () => {
      this.connectionState.isConnected = false;
      this.loggerService.error('Zerodha WebSocket max reconnection attempts reached');
      this.emit('max_reconnect_reached', { attempts: this.connectionState.reconnectAttempts });
    });

    // Order updates
    this.ticker.on('order_update', (order) => {
      this.emit('order_update', order);
    });
  }

  /**
   * Disconnect from WebSocket
   */
  async disconnect() {
    try {
      if (this.ticker) {
        this.ticker.disconnect();
        this.ticker = null;
      }
      
      this.connectionState.isConnected = false;
      this.connectionState.isConnecting = false;
      this.connectionState.lastConnectedAt = null;
      
      this.loggerService.info('Zerodha WebSocket disconnected');
      this.emit('disconnected', { timestamp: new Date() });
      
    } catch (error) {
      this.loggerService.error('Error disconnecting Zerodha WebSocket:', error);
      throw error;
    }
  }

  /**
   * Check if connection is active
   */
  isConnected() {
    return this.connectionState.isConnected && this.ticker && this.ticker.connected();
  }

  /**
   * Get connection state
   */
  getConnectionState() {
    return {
      ...this.connectionState,
      canReconnect: this.connectionState.reconnectAttempts < this.reconnectConfig.maxAttempts
    };
  }

  /**
   * Enable auto-reconnect with custom configuration
   */
  enableAutoReconnect(options = {}) {
    const config = { ...this.reconnectConfig, ...options };
    
    if (this.ticker) {
      this.ticker.autoReconnect(true, config.interval, config.maxAttempts);
    }
    
    this.loggerService.info('Auto-reconnect enabled', config);
  }

  /**
   * Event emitter methods
   */
  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          this.loggerService.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  off(event, handler) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Health check for connection
   */
  async healthCheck() {
    try {
      if (!this.isConnected()) {
        return {
          healthy: false,
          issues: ['Not connected'],
          state: this.getConnectionState()
        };
      }

      // Check if we're receiving ticks (basic connectivity test)
      const lastTickTime = this.getLastTickTime();
      const now = Date.now();
      const timeSinceLastTick = now - lastTickTime;
      
      const issues = [];
      if (timeSinceLastTick > 60000) { // No ticks for 1 minute
        issues.push('No recent ticks received');
      }

      return {
        healthy: issues.length === 0,
        issues,
        state: this.getConnectionState(),
        lastTickTime,
        timeSinceLastTick
      };

    } catch (error) {
      return {
        healthy: false,
        issues: ['Health check failed'],
        error: error.message,
        state: this.getConnectionState()
      };
    }
  }

  getLastTickTime() {
    // This would be implemented by the subscription manager
    return Date.now(); // Placeholder
  }
}
