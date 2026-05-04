/**
 * Zerodha Subscription Manager
 * 
 * Manages instrument subscriptions with batching, rate limiting, and error handling.
 * Follows SOLID principles with single responsibility for subscription management.
 */

export class ZerodhaSubscriptionManager {
  constructor(connectionManager, configService, loggerService) {
    this.connectionManager = connectionManager;
    this.configService = configService;
    this.loggerService = loggerService;
    this.subscribedTokens = new Set();
    this.pendingSubscriptions = new Set();
    this.essentialTokens = new Set([
      256265,   // NIFTY 50
      260105,   // NIFTY BANK
      257801,   // NIFTY FIN SERVICE
      288009,   // NIFTY MID SELECT
    ]);
    this.subscriptionConfig = {
      maxTokens: 3000,
      batchSize: 100,
      batchDelay: 100,
      rateLimitDelay: 50
    };
  }

  /**
   * Subscribe to tokens with batching and error handling
   */
  async subscribeTokens(tokens, options = {}) {
    try {
      if (!this.connectionManager.isConnected()) {
        return this.queueSubscriptions(tokens);
      }

      const config = { ...this.subscriptionConfig, ...options };
      const normalizedTokens = this.normalizeTokens(tokens);
      const cappedTokens = this.capSubscriptions(normalizedTokens, config.maxTokens);
      
      const newTokens = cappedTokens.filter(token => !this.subscribedTokens.has(token));
      
      if (newTokens.length === 0) {
        this.loggerService.info('All tokens already subscribed');
        return {
          subscribed: 0,
          total: this.subscribedTokens.size,
          queued: this.pendingSubscriptions.size
        };
      }

      const result = await this.subscribeInBatches(newTokens, config);
      
      // Update subscribed tokens
      newTokens.forEach(token => this.subscribedTokens.add(token));
      
      this.loggerService.info(`Successfully subscribed to ${result.subscribed} tokens. Total: ${this.subscribedTokens.size}`);
      
      return {
        ...result,
        total: this.subscribedTokens.size,
        queued: this.pendingSubscriptions.size
      };

    } catch (error) {
      this.loggerService.error('Error subscribing to tokens:', error);
      throw error;
    }
  }

  /**
   * Subscribe tokens in batches to avoid rate limiting
   */
  async subscribeInBatches(tokens, config) {
    let subscribedCount = 0;
    const errors = [];

    for (let i = 0; i < tokens.length; i += config.batchSize) {
      const batch = tokens.slice(i, i + config.batchSize);
      
      try {
        await this.subscribeBatch(batch);
        subscribedCount += batch.length;
        
        this.loggerService.info(`Batch ${Math.floor(i / config.batchSize) + 1}: Subscribed to ${batch.length} tokens`);
        
        // Add delay between batches
        if (i + config.batchSize < tokens.length) {
          await this.delay(config.batchDelay);
        }
        
      } catch (error) {
        this.loggerService.error(`Error subscribing batch ${Math.floor(i / config.batchSize) + 1}:`, error);
        errors.push({ batch: Math.floor(i / config.batchSize) + 1, error: error.message });
        
        // Continue with next batch even if current fails
        await this.delay(config.rateLimitDelay);
      }
    }

    return {
      subscribed: subscribedCount,
      total: tokens.length,
      errors
    };
  }

  /**
   * Subscribe a single batch of tokens
   */
  async subscribeBatch(tokens) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Batch subscription timeout for ${tokens.length} tokens`));
      }, 5000);

      try {
        this.connectionManager.ticker.subscribe(tokens);
        this.connectionManager.ticker.setMode(this.connectionManager.ticker.modeFull, tokens);
        
        clearTimeout(timeout);
        resolve();
        
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Unsubscribe from tokens
   */
  async unsubscribeTokens(tokens) {
    try {
      if (!this.connectionManager.isConnected()) {
        return { unsubscribed: 0, total: this.subscribedTokens.size };
      }

      const normalizedTokens = this.normalizeTokens(tokens);
      const validTokens = normalizedTokens.filter(token => this.subscribedTokens.has(token));
      
      if (validTokens.length === 0) {
        return { unsubscribed: 0, total: this.subscribedTokens.size };
      }

      this.connectionManager.ticker.unsubscribe(validTokens);
      
      // Update subscribed tokens
      validTokens.forEach(token => this.subscribedTokens.delete(token));
      
      this.loggerService.info(`Unsubscribed from ${validTokens.length} tokens`);
      
      return {
        unsubscribed: validTokens.length,
        total: this.subscribedTokens.size
      };

    } catch (error) {
      this.loggerService.error('Error unsubscribing from tokens:', error);
      throw error;
    }
  }

  /**
   * Queue subscriptions for when connection is available
   */
  queueSubscriptions(tokens) {
    const normalizedTokens = this.normalizeTokens(tokens);
    normalizedTokens.forEach(token => this.pendingSubscriptions.add(token));
    
    this.loggerService.info(`Queued ${normalizedTokens.length} tokens for next connection`);
    
    return {
      subscribed: 0,
      total: this.subscribedTokens.size,
      queued: this.pendingSubscriptions.size
    };
  }

  /**
   * Process pending subscriptions
   */
  async processPendingSubscriptions() {
    if (this.pendingSubscriptions.size === 0) {
      return;
    }

    const pending = [...this.pendingSubscriptions];
    this.pendingSubscriptions.clear();
    
    this.loggerService.info(`Processing ${pending.length} pending subscriptions`);
    
    try {
      await this.subscribeTokens(pending);
    } catch (error) {
      // Re-queue failed subscriptions
      pending.forEach(token => this.pendingSubscriptions.add(token));
      throw error;
    }
  }

  /**
   * Resubscribe to all tokens after reconnection
   */
  async resubscribeAll() {
    try {
      if (this.subscribedTokens.size === 0) {
        return;
      }

      const tokens = [...this.subscribedTokens];
      const config = this.subscriptionConfig;
      const cappedTokens = this.capSubscriptions(tokens, config.maxTokens);
      
      this.loggerService.info(`Resubscribing to ${cappedTokens.length} tokens after reconnection`);
      
      // Clear current subscriptions and resubscribe
      this.subscribedTokens.clear();
      await this.subscribeInBatches(cappedTokens, config);
      
      cappedTokens.forEach(token => this.subscribedTokens.add(token));
      
    } catch (error) {
      this.loggerService.error('Error resubscribing tokens:', error);
      throw error;
    }
  }

  /**
   * Normalize and filter tokens
   */
  normalizeTokens(tokens) {
    const INDEX_TOKEN_LEGACY_TO_KITE = {
      99926000: 256265,
      99926009: 260105,
      99926037: 257801,
      99926074: 288009,
    };

    return tokens
      .map(token => {
        const num = parseInt(token, 10);
        if (isNaN(num) || num <= 0) return null;
        return INDEX_TOKEN_LEGACY_TO_KITE[num] || num;
      })
      .filter(token => token !== null && !isNaN(token));
  }

  /**
   * Cap subscriptions to maximum allowed
   */
  capSubscriptions(tokens, maxTokens) {
    if (tokens.length <= maxTokens) {
      return tokens;
    }

    // Keep essential tokens first
    const essential = tokens.filter(token => this.essentialTokens.has(token));
    const others = tokens.filter(token => !this.essentialTokens.has(token));
    
    const combined = [...essential, ...others];
    const capped = combined.slice(0, maxTokens);
    
    this.loggerService.warn(`Subscription list truncated to ${maxTokens} (had ${tokens.length})`);
    
    return capped;
  }

  /**
   * Get subscription statistics
   */
  getSubscriptionStats() {
    return {
      subscribedCount: this.subscribedTokens.size,
      pendingCount: this.pendingSubscriptions.size,
      maxTokens: this.subscriptionConfig.maxTokens,
      essentialTokens: this.essentialTokens.size,
      utilizationRate: (this.subscribedTokens.size / this.subscriptionConfig.maxTokens) * 100
    };
  }

  /**
   * Check if token is subscribed
   */
  isSubscribed(token) {
    const normalized = this.normalizeTokens([token])[0];
    return this.subscribedTokens.has(normalized);
  }

  /**
   * Clear all subscriptions
   */
  clearAllSubscriptions() {
    this.subscribedTokens.clear();
    this.pendingSubscriptions.clear();
    this.loggerService.info('All subscriptions cleared');
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
