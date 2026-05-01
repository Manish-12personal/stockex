import WebSocket from 'ws';
import crypto from 'crypto';
import TradingService from './tradingService.js';

let io = null;
let ws = null;
let cryptoData = {};
let reconnectAttempts = 0;
let pingInterval = null;
const MAX_RECONNECT_ATTEMPTS = 10;

// Binance API credentials from env
const BINANCE_API_KEY = process.env.BINANCE_API_KEY || '';
const BINANCE_API_SECRET = process.env.BINANCE_API_SECRET || '';

// Crypto symbols to track
const CRYPTO_SYMBOLS = [
  'btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt',
  'dogeusdt', 'solusdt', 'dotusdt', 'polusdt', 'ltcusdt',
  'avaxusdt', 'linkusdt', 'atomusdt', 'uniusdt', 'xlmusdt',
];

// Initialize Binance WebSocket with Socket.IO instance
export const initBinanceWebSocket = (socketIO) => {
  io = socketIO;
  console.log('Binance WebSocket service initialized');
  connectWebSocket();
};

// Connect to Binance WebSocket
const connectWebSocket = () => {
  // Create stream URL for all symbols
  const streams = CRYPTO_SYMBOLS.map(s => `${s}@ticker`).join('/');
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
  
  const headers = {};
  if (BINANCE_API_KEY) {
    headers['X-MBX-APIKEY'] = BINANCE_API_KEY;
    console.log('Connecting to Binance WebSocket (authenticated)...');
  } else {
    console.log('Connecting to Binance WebSocket (public)...');
  }
  
  ws = new WebSocket(wsUrl, { headers });
  
  ws.on('open', () => {
    console.log(`Binance WebSocket connected${BINANCE_API_KEY ? ' (with API key)' : ''}`);
    reconnectAttempts = 0;
    
    // Keepalive ping every 3 minutes to prevent disconnection
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }, 180000);
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.data) {
        const ticker = message.data;
        const symbol = ticker.s.replace('USDT', '');
        const pair = ticker.s;
        
        const tickData = {
          symbol: symbol,
          pair: pair,
          exchange: 'BINANCE',
          token: pair,
          ltp: parseFloat(ticker.c),
          open: parseFloat(ticker.o),
          high: parseFloat(ticker.h),
          low: parseFloat(ticker.l),
          close: parseFloat(ticker.c),
          change: parseFloat(ticker.p),
          changePercent: parseFloat(ticker.P).toFixed(2),
          volume: parseFloat(ticker.v),
          quoteVolume: parseFloat(ticker.q),
          bid: parseFloat(ticker.b),
          ask: parseFloat(ticker.a),
          lastUpdated: new Date()
        };
        
        // Store in local cache
        cryptoData[pair] = tickData;
        cryptoData[symbol] = tickData;
        
        // Emit to all connected clients via Socket.IO
        if (io) {
          io.emit('crypto_tick', { [pair]: tickData, [symbol]: tickData });
          // Also emit as market_tick for compatibility
          io.emit('market_tick', { [pair]: tickData, [symbol]: tickData });
        }

        TradingService.processPendingOrdersForUsdSpotTick({
          pair,
          symbol,
          bid: tickData.bid,
          ask: tickData.ask,
          ltp: tickData.ltp,
        })
          .then((filled) => {
            if (io && filled?.length) {
              for (const tr of filled) {
                const plain = typeof tr.toObject === 'function' ? tr.toObject() : tr;
                io.emit('trade_update', {
                  type: 'PENDING_FILLED',
                  trade: plain,
                  adminCode: tr.adminCode,
                });
              }
            }
          })
          .catch((err) => console.error('processPendingOrdersForUsdSpotTick:', err?.message || err));
      }
    } catch (error) {
      console.error('Error parsing Binance message:', error.message);
    }
  });
  
  ws.on('error', (error) => {
    console.error('Binance WebSocket error:', error.message);
  });
  
  ws.on('close', () => {
    console.log('Binance WebSocket disconnected');
    if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
    
    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`Reconnecting to Binance in ${delay/1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(connectWebSocket, delay);
    } else {
      console.error('Max reconnection attempts reached for Binance WebSocket');
    }
  });
};

// Get current crypto data
export const getCryptoData = () => cryptoData;

// Get specific crypto price
export const getCryptoPrice = (symbol) => {
  const pair = symbol.toUpperCase().includes('USDT') ? symbol.toUpperCase() : `${symbol.toUpperCase()}USDT`;
  const price = cryptoData[pair] || cryptoData[symbol.toUpperCase()] || null;
  
  // Log for debugging BTC price availability
  if (symbol.toUpperCase().includes('BTC') && price) {
    console.log(`[BTC] Live price: ₹${price.ltp} (${pair}) at ${new Date().toLocaleTimeString()}`);
  }
  
  return price;
};

// Check if WebSocket is connected
export const isConnected = () => ws && ws.readyState === WebSocket.OPEN;

export default {
  initBinanceWebSocket,
  getCryptoData,
  getCryptoPrice,
  isConnected
};
