import WebSocket from 'ws';
import TradingService from './tradingService.js';
import {
  coinGeckoConfigured,
  fetchAggregatedPricesObject,
} from './coingeckoService.js';

let io = null;
let ws = null;
let cryptoData = {};
let reconnectAttempts = 0;
let pingInterval = null;
let coingeckoPollInterval = null;
const MAX_RECONNECT_ATTEMPTS = 10;

/** CoinGecko REST poll — Binance WS disabled when API key set. Clamped 2000–60000 ms. */
function coingeckoPollIntervalMs() {
  const raw = process.env.COINGECKO_POLL_INTERVAL_MS?.trim();
  if (!raw) return 5000;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5000;
  return Math.min(60000, Math.max(2000, Math.round(n)));
}

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || '';

const CRYPTO_SYMBOLS = [
  'btcusdt', 'ethusdt', 'bnbusdt', 'xrpusdt', 'adausdt',
  'dogeusdt', 'solusdt', 'dotusdt', 'polusdt', 'ltcusdt',
  'avaxusdt', 'linkusdt', 'atomusdt', 'uniusdt', 'xlmusdt',
];

/** Thin synthetic bid/ask so USD spot pending-order logic still runs */
function syntheticBidAsk(ltp) {
  const spread = Math.max(ltp * 0.00005, 0.01);
  return { bid: ltp - spread / 2, ask: ltp + spread / 2 };
}

async function emitCoinGeckoTicksOnce() {
  if (!io) return;
  try {
    const batch = await fetchAggregatedPricesObject();
    for (const tickData of Object.values(batch)) {
      const pair = tickData.pair;
      const symbol = tickData.symbol;
      const ltp = Number(tickData.ltp);
      if (!pair || !Number.isFinite(ltp) || ltp <= 0) continue;

      const { bid, ask } = syntheticBidAsk(ltp);
      const enriched = {
        ...tickData,
        token: pair,
        bid,
        ask,
      };

      cryptoData[pair] = enriched;
      cryptoData[symbol] = enriched;

      io.emit('crypto_tick', { [pair]: enriched, [symbol]: enriched });
      io.emit('market_tick', { [pair]: enriched, [symbol]: enriched });

      TradingService.processPendingOrdersForUsdSpotTick({
        pair,
        symbol,
        bid,
        ask,
        ltp,
      }).catch((err) =>
        console.error('processPendingOrdersForUsdSpotTick:', err?.message || err),
      );
    }
  } catch (e) {
    console.warn('[crypto feed] CoinGecko poll failed:', e?.message || e);
  }
}

function startCoinGeckoPoll() {
  if (coingeckoPollInterval) clearInterval(coingeckoPollInterval);
  emitCoinGeckoTicksOnce();
  const ms = coingeckoPollIntervalMs();
  coingeckoPollInterval = setInterval(emitCoinGeckoTicksOnce, ms);
}

export const initBinanceWebSocket = (socketIO) => {
  io = socketIO;

  if (coinGeckoConfigured()) {
    const pollMs = coingeckoPollIntervalMs();
    console.log(
      `[crypto feed] CoinGecko mode — Binance WebSocket disabled (geo-safe); polling every ${pollMs}ms`,
    );
    startCoinGeckoPoll();
    return;
  }

  console.log('Binance WebSocket service initialized');
  connectWebSocket();
};

const connectWebSocket = () => {
  const streams = CRYPTO_SYMBOLS.map((s) => `${s}@ticker`).join('/');
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
          symbol,
          pair,
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
          lastUpdated: new Date(),
        };

        cryptoData[pair] = tickData;
        cryptoData[symbol] = tickData;

        if (io) {
          io.emit('crypto_tick', { [pair]: tickData, [symbol]: tickData });
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
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }

    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
      console.log(`Reconnecting to Binance in ${delay / 1000}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
      setTimeout(connectWebSocket, delay);
    } else {
      console.error('Max reconnection attempts reached for Binance WebSocket');
    }
  });
};

export const getCryptoData = () => cryptoData;

export const getCryptoPrice = (symbol) => {
  const pair = symbol.toUpperCase().includes('USDT')
    ? symbol.toUpperCase()
    : `${symbol.toUpperCase()}USDT`;
  return cryptoData[pair] || cryptoData[symbol.toUpperCase()] || null;
};

export const isConnected = () =>
  coinGeckoConfigured()
    ? true
    : ws && ws.readyState === WebSocket.OPEN;

export default {
  initBinanceWebSocket,
  getCryptoData,
  getCryptoPrice,
  isConnected,
};
