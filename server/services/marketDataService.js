import WebSocket from 'ws';
import Instrument from '../models/Instrument.js';

class MarketDataService {
  constructor() {
    this.ws = null;
    this.feedToken = null;
    this.clientCode = null;
    this.apiKey = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.subscribedTokens = new Set();
    this.priceCallbacks = [];
    this.heartbeatInterval = null;
  }

  // Initialize with credentials
  init(feedToken, clientCode, apiKey) {
    this.feedToken = feedToken;
    this.clientCode = clientCode;
    this.apiKey = apiKey;
  }

  // Connect to Angel One WebSocket
  connect() {
    if (!this.feedToken) {
      console.error('Feed token not available. Please login first.');
      return;
    }

    const wsUrl = 'wss://smartapisocket.angelone.in/smart-stream';
    
    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.feedToken}`,
        'x-api-key': this.apiKey,
        'x-client-code': this.clientCode,
        'x-feed-token': this.feedToken
      }
    });

    this.ws.on('open', () => {
      console.log('WebSocket connected to Angel One');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Start heartbeat
      this.startHeartbeat();
      
      // Resubscribe to tokens
      if (this.subscribedTokens.size > 0) {
        this.subscribeTokens([...this.subscribedTokens]);
      }
    });

    this.ws.on('message', (data) => {
      this.handleMessage(data);
    });

    this.ws.on('close', () => {
      console.log('WebSocket disconnected');
      this.isConnected = false;
      this.stopHeartbeat();
      this.attemptReconnect();
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error.message);
    });
  }

  // Handle incoming messages
  handleMessage(data) {
    try {
      // Angel One sends binary data
      if (Buffer.isBuffer(data)) {
        const parsed = this.parseBinaryData(data);
        if (parsed) {
          this.updateInstrumentPrice(parsed);
          this.notifyCallbacks(parsed);
        }
      } else {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message:', message);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }

  // Parse binary market data from Angel One
  parseBinaryData(buffer) {
    try {
      // Angel One binary format parsing
      // Subscription mode: 1 byte
      // Exchange type: 1 byte
      // Token: 25 bytes (string)
      // Sequence number: 8 bytes
      // Exchange timestamp: 8 bytes
      // LTP: 8 bytes
      // ... more fields based on mode
      
      if (buffer.length < 51) return null;
      
      const subscriptionMode = buffer.readUInt8(0);
      const exchangeType = buffer.readUInt8(1);
      const token = buffer.slice(2, 27).toString().replace(/\0/g, '').trim();
      const sequenceNumber = buffer.readBigInt64LE(27);
      const exchangeTimestamp = buffer.readBigInt64LE(35);
      const ltp = buffer.readBigInt64LE(43) / 100; // Price in paise
      
      let result = {
        token,
        exchangeType,
        ltp,
        timestamp: new Date(Number(exchangeTimestamp))
      };
      
      // Extended data for full mode (mode 3)
      if (subscriptionMode === 3 && buffer.length >= 123) {
        result.open = buffer.readBigInt64LE(83) / 100;
        result.high = buffer.readBigInt64LE(91) / 100;
        result.low = buffer.readBigInt64LE(99) / 100;
        result.close = buffer.readBigInt64LE(107) / 100;
        result.volume = Number(buffer.readBigInt64LE(115));
      }
      
      return result;
    } catch (error) {
      console.error('Error parsing binary data:', error);
      return null;
    }
  }

  // Update instrument price in database
  async updateInstrumentPrice(priceData) {
    try {
      await Instrument.updatePrice(priceData.token, {
        ltp: priceData.ltp,
        open: priceData.open || 0,
        high: priceData.high || 0,
        low: priceData.low || 0,
        close: priceData.close || 0,
        volume: priceData.volume || 0
      });
    } catch (error) {
      // Silently fail for price updates
    }
  }

  // Subscribe to instrument tokens
  subscribeTokens(tokens, mode = 3) {
    if (!this.isConnected || !this.ws) {
      console.log('WebSocket not connected. Queuing tokens for subscription.');
      tokens.forEach(t => this.subscribedTokens.add(t));
      return;
    }

    // Group tokens by exchange
    const exchangeTokens = {};
    tokens.forEach(token => {
      // Assuming format: "EXCHANGE|TOKEN" or just token with exchange lookup
      const [exchange, tokenId] = token.includes('|') ? token.split('|') : ['nse_cm', token];
      if (!exchangeTokens[exchange]) exchangeTokens[exchange] = [];
      exchangeTokens[exchange].push(tokenId);
      this.subscribedTokens.add(token);
    });

    // Send subscription request
    const subscribeRequest = {
      correlationID: `sub_${Date.now()}`,
      action: 1, // Subscribe
      params: {
        mode: mode, // 1=LTP, 2=Quote, 3=SnapQuote
        tokenList: Object.entries(exchangeTokens).map(([exchange, tokens]) => ({
          exchangeType: this.getExchangeCode(exchange),
          tokens: tokens
        }))
      }
    };

    this.ws.send(JSON.stringify(subscribeRequest));
    console.log('Subscribed to tokens:', tokens.length);
  }

  // Unsubscribe from tokens
  unsubscribeTokens(tokens) {
    if (!this.isConnected || !this.ws) return;

    const exchangeTokens = {};
    tokens.forEach(token => {
      const [exchange, tokenId] = token.includes('|') ? token.split('|') : ['nse_cm', token];
      if (!exchangeTokens[exchange]) exchangeTokens[exchange] = [];
      exchangeTokens[exchange].push(tokenId);
      this.subscribedTokens.delete(token);
    });

    const unsubscribeRequest = {
      correlationID: `unsub_${Date.now()}`,
      action: 0, // Unsubscribe
      params: {
        mode: 3,
        tokenList: Object.entries(exchangeTokens).map(([exchange, tokens]) => ({
          exchangeType: this.getExchangeCode(exchange),
          tokens: tokens
        }))
      }
    };

    this.ws.send(JSON.stringify(unsubscribeRequest));
  }

  // Get exchange code for Angel One
  getExchangeCode(exchange) {
    const codes = {
      'nse_cm': 1,
      'nse_fo': 2,
      'bse_cm': 3,
      'bse_fo': 4,
      'mcx_fo': 5,
      'ncx_fo': 7,
      'cde_fo': 13
    };
    return codes[exchange.toLowerCase()] || 1;
  }

  // Register callback for price updates
  onPriceUpdate(callback) {
    this.priceCallbacks.push(callback);
  }

  // Notify all callbacks
  notifyCallbacks(priceData) {
    this.priceCallbacks.forEach(cb => {
      try {
        cb(priceData);
      } catch (error) {
        console.error('Callback error:', error);
      }
    });
  }

  // Start heartbeat
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected && this.ws) {
        this.ws.ping();
      }
    }, 30000);
  }

  // Stop heartbeat
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // Attempt reconnection
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  // Disconnect
  disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  // Get connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      subscribedTokens: this.subscribedTokens.size,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
const marketDataService = new MarketDataService();

export default marketDataService;
