import { KiteTicker } from 'kiteconnect';
import MarginMonitorService from './marginMonitorService.js';
import Instrument from '../models/Instrument.js';

let ticker = null;
let io = null;
let subscribedTokens = [];
/** Tokens to subscribe on next ticker connect (e.g. user watchlist while Zerodha was still connecting) */
let pendingUserSubscribe = new Set();
let marketData = {};
let marginMonitorEnabled = true; // Toggle for margin monitoring

// Initialize WebSocket with Socket.IO instance
export const initZerodhaWebSocket = (socketIO) => {
  io = socketIO;
  // Initialize margin monitor with same Socket.IO instance
  MarginMonitorService.init(socketIO);
  console.log('Zerodha WebSocket service initialized with TradePro Margin Monitor');
};

/**
 * Older seeds used placeholder tokens (99926xxx). Kite Connect uses these instrument_token values.
 * @see https://kite.trade/forum/discussion/2825/how-to-get-ticks-for-indices-like-banknifty-nifty-50
 */
const INDEX_TOKEN_LEGACY_TO_KITE = {
  99926000: 256265,
  99926009: 260105,
  99926037: 257801,
  99926074: 288009,
};

const INDEX_TOKEN_KITE_TO_LEGACY = {
  256265: ['99926000'],
  260105: ['99926009'],
  257801: ['99926037'],
  288009: ['99926074'],
};

/** Display symbol when Kite omits tradingsymbol on non-tradable index ticks */
const KITE_INDEX_SYMBOL = {
  256265: 'NIFTY 50',
  260105: 'NIFTY BANK',
  257801: 'NIFTY FIN SERVICE',
  288009: 'NIFTY MID SELECT',
};

export function normalizeKiteInstrumentToken(t) {
  const n = parseInt(t, 10);
  if (Number.isNaN(n) || n <= 0) return n;
  return INDEX_TOKEN_LEGACY_TO_KITE[n] || n;
}

// Essential tokens that should always be subscribed (for games and indices)
const ESSENTIAL_TOKENS = [
  256265,   // NIFTY 50 (Index)
  260105,   // NIFTY BANK (Index)
  257801,   // NIFTY FIN SERVICE
  288009,   // NIFTY MID SELECT
];

// Connect to Zerodha WebSocket
export const connectTicker = (apiKey, accessToken, tokens = []) => {
  if (ticker) {
    ticker.disconnect();
  }

  ticker = new KiteTicker({
    api_key: apiKey,
    access_token: accessToken
  });

  ticker.autoReconnect(true, 1000, 5); // Auto reconnect with unlimited retries (1000), 5 second interval

  ticker.on('connect', () => {
    console.log('Zerodha WebSocket connected');
    // Broadcast connection status to all clients
    if (io) {
      io.emit('zerodha_status', { connected: true });
    }
    const queued = [...pendingUserSubscribe];
    pendingUserSubscribe.clear();
    // Always subscribe to essential tokens (NIFTY 50, BANKNIFTY) for games, plus any queued user tokens
    const allTokens = [...new Set([...ESSENTIAL_TOKENS, ...tokens, ...queued])];
    console.log(
      `Subscribing to ${allTokens.length} tokens (including ${ESSENTIAL_TOKENS.length} essential + ${queued.length} queued)`
    );
    if (allTokens.length > 0) {
      subscribeTokens(allTokens);
    }
  });

  ticker.on('ticks', (ticks) => {
    processTicks(ticks);
  });

  ticker.on('disconnect', () => {
    console.log('Zerodha WebSocket disconnected - will auto-reconnect');
    // Broadcast disconnection status to all clients
    if (io) {
      io.emit('zerodha_status', { connected: false });
    }
  });

  ticker.on('error', (error) => {
    const msg = error?.message || String(error);
    console.error('Zerodha WebSocket error:', msg);
    if (String(msg).includes('403')) {
      console.error(
        '[Zerodha] WebSocket 403: access_token is usually expired or invalid. Super Admin → Connect Zerodha again (do not paste logs: they may contain secrets).'
      );
    }
    // Don't disconnect on error, let auto-reconnect handle it
  });

  ticker.on('reconnect', (reconnect_count, reconnect_interval) => {
    console.log(`Zerodha WebSocket reconnecting... Attempt: ${reconnect_count}, Interval: ${reconnect_interval}s`);
    setTimeout(() => {
      if (!ticker || !ticker.connected()) return;
      if (subscribedTokens.length > 0) {
        console.log(`Resubscribing to ${subscribedTokens.length} tokens after reconnection`);
        ticker.subscribe(subscribedTokens);
        ticker.setMode(ticker.modeFull, subscribedTokens);
      }
      const queued = [...pendingUserSubscribe];
      if (queued.length > 0) {
        pendingUserSubscribe.clear();
        subscribeTokens(queued);
      }
    }, 1000);
  });

  ticker.on('noreconnect', () => {
    console.log('Zerodha WebSocket max reconnection attempts reached - this should not happen with 1000 retries');
    if (io) {
      io.emit('zerodha_status', { connected: false, error: 'Max reconnection attempts reached' });
    }
  });

  ticker.on('order_update', (order) => {
    console.log('Order update:', order);
    if (io) {
      io.emit('order_update', order);
    }
  });

  ticker.connect();
  return ticker;
};

// Subscribe to instrument tokens in batches
// Zerodha has limits: ~3000 tokens total, and batching helps avoid issues
const BATCH_SIZE = 100; // Subscribe in batches of 100 tokens
const BATCH_DELAY = 100; // 100ms delay between batches

export const subscribeTokens = async (tokens) => {
  // Map legacy DB tokens → official Kite tokens so Zerodha streams match Kite / TradingView
  const numericTokens = tokens
    .map((t) => normalizeKiteInstrumentToken(t))
    .filter((t) => !isNaN(t) && t > 0);

  if (!ticker || !ticker.connected()) {
    numericTokens.forEach((t) => pendingUserSubscribe.add(t));
    console.log(
      `Ticker not connected; queued ${numericTokens.length} token(s) for next connect (queue size ${pendingUserSubscribe.size})`
    );
    return { subscribed: 0, total: subscribedTokens.length, queued: numericTokens.length };
  }

  // Remove already subscribed tokens
  const newTokens = numericTokens.filter(t => !subscribedTokens.includes(t));
  
  if (newTokens.length === 0) {
    console.log('All tokens already subscribed');
    return { subscribed: 0, total: subscribedTokens.length };
  }
  
  console.log(`Subscribing to ${newTokens.length} new tokens in batches of ${BATCH_SIZE}...`);
  
  // Subscribe in batches to avoid overwhelming the connection
  let subscribedCount = 0;
  for (let i = 0; i < newTokens.length; i += BATCH_SIZE) {
    const batch = newTokens.slice(i, i + BATCH_SIZE);
    
    try {
      ticker.subscribe(batch);
      ticker.setMode(ticker.modeFull, batch);
      subscribedCount += batch.length;
      console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: Subscribed to ${batch.length} tokens (${subscribedCount}/${newTokens.length})`);
      
      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < newTokens.length) {
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    } catch (error) {
      console.error(`Error subscribing batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
    }
  }
  
  subscribedTokens = [...new Set([...subscribedTokens, ...newTokens])];
  console.log(`Successfully subscribed to ${subscribedCount} tokens. Total subscribed: ${subscribedTokens.length}`);
  
  return { subscribed: subscribedCount, total: subscribedTokens.length };
};

// Unsubscribe from tokens
export const unsubscribeTokens = (tokens) => {
  if (!ticker || !ticker.connected()) return;

  const numericTokens = tokens.map((t) => normalizeKiteInstrumentToken(t));
  ticker.unsubscribe(numericTokens);
  subscribedTokens = subscribedTokens.filter((t) => !numericTokens.includes(t));
};

// Process incoming ticks and broadcast to clients
const processTicks = (ticks) => {
  const serverTimestamp = Date.now(); // Capture server time immediately
  const updates = {};
  const canonicalOnly = {};

  // PHASE 1: Build tick data objects (minimal processing)
  for (const tick of ticks) {
    const token = tick.instrument_token.toString();
    const nTok = parseInt(token, 10);

    const rawBid = tick.depth?.buy?.[0]?.price;
    const rawAsk = tick.depth?.sell?.[0]?.price;

    const bestBid = rawBid && rawBid > 0 ? rawBid : tick.last_price;
    const bestAsk = rawAsk && rawAsk > 0 ? rawAsk : tick.last_price;

    const isUpperCircuit = (!rawAsk || rawAsk === 0) && tick.last_price > 0;
    const isLowerCircuit = (!rawBid || rawBid === 0) && tick.last_price > 0;
    const circuitStatus = isUpperCircuit ? 'UC' : isLowerCircuit ? 'LC' : null;

    const indexSym = KITE_INDEX_SYMBOL[nTok];
    const tickData = {
      token,
      symbol: tick.tradable ? tick.tradingsymbol : indexSym || tick.tradingsymbol,
      ltp: tick.last_price,
      bid: bestBid,
      ask: bestAsk,
      rawBid: rawBid || 0,
      rawAsk: rawAsk || 0,
      circuit: circuitStatus,
      open: tick.ohlc?.open,
      high: tick.ohlc?.high,
      low: tick.ohlc?.low,
      close: tick.ohlc?.close,
      change: tick.change,
      changePercent:
        tick.change_percent ||
        (tick.ohlc?.close
          ? (((tick.last_price - tick.ohlc.close) / tick.ohlc.close) * 100).toFixed(2)
          : 0),
      volume: tick.volume_traded || tick.volume,
      buyQuantity: tick.total_buy_quantity,
      sellQuantity: tick.total_sell_quantity,
      lastTradeTime: tick.last_trade_time,
      oi: tick.oi,
      oiDayHigh: tick.oi_day_high,
      oiDayLow: tick.oi_day_low,
      depth: tick.depth,
      lastUpdated: new Date(),
      serverTimestamp, // Add server timestamp for latency tracking
    };

    marketData[token] = tickData;
    updates[token] = tickData;
    canonicalOnly[token] = tickData;

    for (const leg of INDEX_TOKEN_KITE_TO_LEGACY[nTok] || []) {
      const alias = { ...tickData, token: String(leg) };
      marketData[String(leg)] = alias;
      updates[String(leg)] = alias;
    }
  }

  // PHASE 2: IMMEDIATE BROADCAST - Send to clients FIRST before any heavy processing
  if (io && Object.keys(updates).length > 0) {
    io.emit('market_tick', updates);
  }

  // PHASE 3: DEFERRED PROCESSING - Run margin monitoring and DB updates asynchronously
  // Use setImmediate to defer to next event loop iteration (non-blocking)
  if (marginMonitorEnabled && Object.keys(canonicalOnly).length > 0) {
    setImmediate(() => {
      for (const [tok, tickData] of Object.entries(canonicalOnly)) {
        // Margin monitoring (async, non-blocking)
        MarginMonitorService.onPriceTick(tok, tickData.ltp, tickData).catch((err) =>
          console.error(`Margin monitor error for token ${tok}:`, err.message)
        );
        // Database update (async, non-blocking)
        updateInstrumentLastPrice(tok, tickData).catch((err) =>
          console.error(`DB update error for token ${tok}:`, err.message)
        );
      }
    });
  }
};

// Update instrument's last price for fallback when market is closed
const updateInstrumentLastPrice = async (token, tickData) => {
  try {
    const nTok = parseInt(token, 10);
    const tokenVariants = [token.toString()];
    if (INDEX_TOKEN_KITE_TO_LEGACY[nTok]) {
      tokenVariants.push(...INDEX_TOKEN_KITE_TO_LEGACY[nTok]);
    }

    const updateFields = {
      lastPrice: tickData.ltp,
      ltp: tickData.ltp,
      open: tickData.open,
      high: tickData.high,
      low: tickData.low,
      close: tickData.close,
      change: tickData.change,
      changePercent: tickData.changePercent,
      lastUpdated: new Date(),
    };

    // Update lastBid and lastAsk if available
    if (tickData.bid && tickData.bid > 0) {
      updateFields.lastBid = tickData.bid;
    }
    if (tickData.ask && tickData.ask > 0) {
      updateFields.lastAsk = tickData.ask;
    }

    await Instrument.updateMany(
      { token: { $in: tokenVariants } },
      {
        $set: updateFields,
      },
      { upsert: false }
    );
  } catch (error) {
    console.error(`Failed to update last price for token ${token}:`, error.message);
  }
};

// Get current market data
export const getMarketData = () => {
  return marketData;
};

// Get ticker status
export const getTickerStatus = () => {
  return {
    connected: ticker ? ticker.connected() : false,
    subscribedTokens: subscribedTokens.length
  };
};

// Disconnect ticker
export const disconnectTicker = () => {
  if (ticker) {
    ticker.disconnect();
    ticker = null;
    subscribedTokens = [];
    pendingUserSubscribe.clear();
    marketData = {};
  }
};

// Toggle margin monitoring on/off
export const setMarginMonitorEnabled = (enabled) => {
  marginMonitorEnabled = enabled;
  console.log(`Margin monitoring ${enabled ? 'enabled' : 'disabled'}`);
};

// Get margin monitor status
export const isMarginMonitorEnabled = () => marginMonitorEnabled;

export default {
  initZerodhaWebSocket,
  connectTicker,
  subscribeTokens,
  unsubscribeTokens,
  getMarketData,
  getTickerStatus,
  disconnectTicker,
  setMarginMonitorEnabled,
  isMarginMonitorEnabled,
  normalizeKiteInstrumentToken,
};
