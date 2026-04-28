import express from 'express';
import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { protectAdmin, protectUser, superAdminOnly } from '../middleware/auth.js';
import { connectTicker, subscribeTokens, getMarketData, getTickerStatus, disconnectTicker } from '../services/zerodhaWebSocket.js';
import { fetchNifty50SessionClearing15mCached } from '../utils/kiteNiftyQuote.js';
import { kolkataCalendarDateString } from '../utils/derivativeExpiry.js';

const router = express.Router();

// Socket.IO instance (set from index.js)
let io = null;
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Session file path for persistence
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SESSION_FILE = path.join(__dirname, '../.zerodha-session.json');

// Helper: Parse CSV line properly handling quoted fields (names with commas, etc.)
const parseCSVLine = (line) => {
  const values = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
};

/** Kite MCX FUT: longest base match (CRUDEOILM before CRUDEOIL). Do not use `name` (e.g. "CRUDE OIL") as key. */
const MCX_FUT_BASES_DESC = [
  'CRUDEOILM',
  'CRUDEOIL',
  'GOLDGUINEA',
  'GOLDPETAL',
  'GOLDM',
  'GOLD',
  'SILVERM',
  'SILVERMIC',
  'SILVER',
  'NATURALGAS',
  'ALUMINIUM',
  'ALUMINUM',
  'MENTHAOIL',
  'COTTON',
  'COPPER',
  'ZINC',
  'LEAD',
  'NICKEL',
  'CPO'
];

function mcxFuturesBaseFromKite(tradingsymbol) {
  const t = String(tradingsymbol || '').toUpperCase();
  for (const base of MCX_FUT_BASES_DESC) {
    if (t.startsWith(base)) return base;
  }
  // e.g. BASE12JAN26FUT → letters before first digit
  const m = t.match(/^([A-Z]+)\d/);
  return m ? m[1] : null;
}

/** CSV / seed row fields — never restored from pre-reset DB doc (token & contract identity stay from Kite). */
const ZERODHA_SYNC_KITE_FIELD_KEYS = new Set([
  'token',
  'symbol',
  'name',
  'exchange',
  'segment',
  'displaySegment',
  'instrumentType',
  'optionType',
  'strike',
  'expiry',
  'category',
  'tradingSymbol',
  'lotSize',
  'tickSize',
  'ltp',
  'open',
  'high',
  'low',
  'close',
  'change',
  'changePercent',
  'volume',
  'lastUpdated',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
]);

function exchangeSymbolPreserveKey(doc) {
  if (!doc?.exchange || doc.symbol == null || String(doc.symbol).trim() === '') return null;
  return `${String(doc.exchange).toUpperCase()}:${String(doc.symbol).toUpperCase()}`;
}

/**
 * After a full DB wipe, re-apply super-admin fields (tradingDefaults, visibility, circuit, etc.)
 * from the previous row: match by Zerodha token first, else by exchange+symbol (MCX one-row-per-underlying token rollover).
 */
function mergeInstrumentPreservedFromBackup(kiteDoc, preserveByToken, preserveByExchangeSymbol) {
  const tok = String(kiteDoc.token ?? '');
  let prev = preserveByToken.get(tok);
  if (!prev && preserveByExchangeSymbol) {
    const k = exchangeSymbolPreserveKey(kiteDoc);
    if (k) prev = preserveByExchangeSymbol.get(k);
  }
  if (!prev) return kiteDoc;
  const out = { ...kiteDoc };
  for (const [key, val] of Object.entries(prev)) {
    if (ZERODHA_SYNC_KITE_FIELD_KEYS.has(key)) continue;
    if (val === undefined) continue;
    out[key] = val;
  }
  return out;
}

// Load session from file if exists
const loadSession = () => {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      // Check if session is still valid (not expired)
      if (data.expiresAt && new Date(data.expiresAt) > new Date()) {
        console.log('Loaded Zerodha session from file:', data.userId);
        return data;
      }
    }
  } catch (err) {
    console.error('Error loading Zerodha session:', err.message);
  }
  return { accessToken: null, publicToken: null, userId: null, expiresAt: null };
};

// Save session to file
const saveSession = (session) => {
  try {
    console.log('Attempting to save session to:', SESSION_FILE);
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2));
    console.log('Saved Zerodha session to file successfully');
  } catch (err) {
    console.error('Error saving Zerodha session:', err.message, err.stack);
  }
};

// Zerodha session storage (persisted to file)
let zerodhaSession = loadSession();

function isZerodhaSessionValid() {
  return !!(
    zerodhaSession.accessToken &&
    zerodhaSession.expiresAt &&
    new Date(zerodhaSession.expiresAt) > new Date()
  );
}

/**
 * Start Kite WebSocket ticker using in-memory zerodhaSession (must be valid).
 * Idempotent if ticker already connected.
 */
async function startZerodhaTickerFromCurrentSession() {
  const apiKey = process.env.ZERODHA_API_KEY;
  if (!apiKey) {
    console.warn('[Zerodha] Cannot start ticker: ZERODHA_API_KEY not set');
    return;
  }
  if (!isZerodhaSessionValid()) {
    return;
  }
  if (getTickerStatus().connected) {
    return;
  }

  const Instrument = (await import('../models/Instrument.js')).default;
  const instruments = await Instrument.find({
    isEnabled: true,
    $or: [
      { symbol: 'NIFTY 50' },
      { symbol: 'NIFTY BANK' },
      { exchange: 'NSE', segment: 'NSE' },
      { exchange: 'NFO', instrument_type: 'FUT' },
    ],
  })
    .select('token')
    .limit(500)
    .lean();
  const tokens = instruments.map((i) => parseInt(i.token, 10)).filter((t) => !Number.isNaN(t));
  connectTicker(apiKey, zerodhaSession.accessToken, tokens);
  console.log(
    `[Zerodha] WebSocket ticker started with ${tokens.length} instruments (session user ${zerodhaSession.userId || '?'})`
  );
}

/**
 * After server boot (Mongo connected), reconnect Kite ticker if a valid session file was loaded.
 * Does not throw — logs errors only.
 */
export async function restoreZerodhaTickerIfNeeded() {
  try {
    await startZerodhaTickerFromCurrentSession();
  } catch (err) {
    console.error('[Zerodha] restoreZerodhaTickerIfNeeded failed:', err.message);
  }
}

// Get Zerodha connection status
router.get('/status', (req, res) => {
  // Get actual WebSocket ticker status
  const tickerStatus = getTickerStatus();
  
  const isSessionValid = isZerodhaSessionValid();
  
  // Treat as connected only if session valid AND ticker is connected
  const isConnected = isSessionValid && tickerStatus.connected;
  
  res.json({
    connected: isConnected,
    sessionValid: isSessionValid,
    tickerConnected: tickerStatus.connected,
    subscribedTokens: tickerStatus.subscribedTokens,
    userId: zerodhaSession.userId,
    expiresAt: zerodhaSession.expiresAt
  });
});

// Get Kite login URL - redirect user to Zerodha for authentication
router.get('/login-url', protectAdmin, superAdminOnly, (req, res) => {
  try {
    const apiKey = process.env.ZERODHA_API_KEY;
    
    if (!apiKey) {
      return res.status(400).json({ message: 'Zerodha API Key not configured in .env' });
    }
    
    // Kite Connect login URL
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}`;
    const redirectUrl = `${process.env.SERVER_URL || 'http://localhost:5001'}/api/zerodha/callback`;
    if (process.env.NODE_ENV !== 'production') {
      console.info('[Zerodha] Register this exact Redirect URL in developers.kite.trade → your app:', redirectUrl);
    }

    res.json({
      loginUrl,
      redirectUrl
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Callback URL - Zerodha redirects here after login
router.get('/callback', async (req, res) => {
  try {
    const { request_token, status } = req.query;
    
    if (status === 'cancelled') {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=cancelled`);
    }
    
    if (!request_token) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=error&message=No request token`);
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    const apiSecret = process.env.ZERODHA_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=error&message=API credentials not configured`);
    }
    
    // Generate checksum: SHA256(api_key + request_token + api_secret)
    const checksum = crypto
      .createHash('sha256')
      .update(apiKey + request_token + apiSecret)
      .digest('hex');
    
    // Exchange request token for access token
    const response = await axios.post(
      'https://api.kite.trade/session/token',
      new URLSearchParams({
        api_key: apiKey,
        request_token: request_token,
        checksum: checksum
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'X-Kite-Version': '3'
        }
      }
    );
    
    if (response.data.status === 'success' && response.data.data) {
      zerodhaSession = {
        accessToken: response.data.data.access_token,
        publicToken: response.data.data.public_token,
        userId: response.data.data.user_id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Token valid for 1 day
      };
      
      // Save session to file for persistence across restarts
      saveSession(zerodhaSession);
      
      console.log('Zerodha login successful:', zerodhaSession.userId);

      // Defer ticker start so this HTTP response returns immediately (avoid hanging the admin redirect)
      setImmediate(() => {
        startZerodhaTickerFromCurrentSession().catch((wsError) => {
          console.error('Failed to start WebSocket ticker:', wsError.message);
        });
      });

      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=success`);
    } else {
      return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=error&message=${encodeURIComponent(response.data.message || 'Login failed')}`);
    }
  } catch (error) {
    console.error('Zerodha callback error:', error.response?.data || error.message);
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/admin/market-control?zerodha=error&message=${encodeURIComponent(error.response?.data?.message || error.message)}`);
  }
});

// Logout / Invalidate session
router.post('/logout', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (zerodhaSession.accessToken) {
      const apiKey = process.env.ZERODHA_API_KEY;
      
      // Invalidate session on Zerodha
      try {
        await axios.delete(
          `https://api.kite.trade/session/token?api_key=${apiKey}&access_token=${zerodhaSession.accessToken}`,
          {
            headers: {
              'X-Kite-Version': '3',
              'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
            }
          }
        );
      } catch (e) {
        // Ignore logout errors
      }
    }
    
    zerodhaSession = {
      accessToken: null,
      publicToken: null,
      userId: null,
      expiresAt: null
    };
    
    // Clear session file
    saveSession(zerodhaSession);
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get last known price for games display (NIFTY 50, BTC, etc.)
// Works even when market is closed - returns last cached or API price
// ?authoritative=1 — use Kite REST quote first (same source as Kite web LTP) to match Zerodha UI
router.get('/game-price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const authoritative = ['1', 'true', 'yes'].includes(String(req.query.authoritative || '').toLowerCase());

    // Map symbol to token
    const symbolMap = {
      'NIFTY': { token: '256265', exchange: 'NSE', zerodhaSymbol: 'NSE:NIFTY 50' },
      'NIFTY50': { token: '256265', exchange: 'NSE', zerodhaSymbol: 'NSE:NIFTY 50' },
      'BANKNIFTY': { token: '260105', exchange: 'NSE', zerodhaSymbol: 'NSE:NIFTY BANK' },
    };

    const symbolInfo = symbolMap[symbol.toUpperCase()];
    if (!symbolInfo) {
      return res.json({ price: null, source: 'unknown_symbol' });
    }

    const fetchKiteQuote = async () => {
      if (!zerodhaSession.accessToken) return null;
      const apiKey = process.env.ZERODHA_API_KEY;
      if (!apiKey) return null;
      const response = await axios.get(`https://api.kite.trade/quote?i=${symbolInfo.zerodhaSymbol}`, {
        headers: {
          'X-Kite-Version': '3',
          Authorization: `token ${apiKey}:${zerodhaSession.accessToken}`,
        },
      });
      if (response.data.status !== 'success' || !response.data.data) return null;
      const quote = Object.values(response.data.data)[0];
      if (!quote) return null;
      const prevDay = quote.ohlc?.close;
      return {
        price: quote.last_price,
        ltp: quote.last_price,
        /** Previous session close from Kite (reference for net change %) */
        close: prevDay != null && Number.isFinite(Number(prevDay)) ? Number(prevDay) : Number(quote.last_price),
        prevDayClose: prevDay != null && Number.isFinite(Number(prevDay)) ? Number(prevDay) : null,
        open: quote.ohlc?.open,
        high: quote.ohlc?.high,
        low: quote.ohlc?.low,
        change: quote.net_change,
        changePercent:
          prevDay != null && Number.isFinite(Number(prevDay)) && Number(prevDay) !== 0
            ? ((quote.net_change / Number(prevDay)) * 100).toFixed(2)
            : '0.00',
        lastUpdated: new Date(),
      };
    };

    if (authoritative) {
      try {
        const q = await fetchKiteQuote();
        if (q && q.price != null && Number.isFinite(Number(q.price))) {
          let sessionClearing = null;
          let sessionClearingBarEnd = null;
          let sessionClearingBarEndISO = null;
          try {
            const clr = await fetchNifty50SessionClearing15mCached();
            if (clr && Number.isFinite(Number(clr.close))) {
              sessionClearing = Number(clr.close);
              sessionClearingBarEnd = clr.barTime;
              sessionClearingBarEndISO = clr.barTimeISO;
            }
          } catch (clrErr) {
            console.warn('Game price session clearing (15m) error:', clrErr.message);
          }
          return res.json({
            ...q,
            source: 'api_authoritative',
            sessionClearing,
            sessionClearingBarEnd,
            sessionClearingBarEndISO,
            sessionClearingNote:
              'Last 15m bar close today (IST) from Kite historical — matches Kite 15m chart final C',
          });
        }
      } catch (apiErr) {
        console.error('Game price authoritative quote error:', apiErr.message);
      }
    }

    const wsData = getMarketData();
    const wsTick = wsData[symbolInfo.token];
    if (wsTick && wsTick.ltp != null && Number.isFinite(Number(wsTick.ltp))) {
      const lp = Number(wsTick.ltp);
      const refClose = wsTick.close != null && Number.isFinite(Number(wsTick.close)) ? Number(wsTick.close) : lp;
      return res.json({
        price: lp,
        ltp: lp,
        close: refClose,
        prevDayClose: wsTick.close != null && Number.isFinite(Number(wsTick.close)) ? Number(wsTick.close) : null,
        open: wsTick.open,
        high: wsTick.high,
        low: wsTick.low,
        change: wsTick.change,
        changePercent: wsTick.changePercent,
        source: 'websocket',
        sessionClearing: null,
        lastUpdated: wsTick.lastUpdated,
      });
    }

    try {
      const q = await fetchKiteQuote();
      if (q && q.price != null && Number.isFinite(Number(q.price))) {
        return res.json({ ...q, source: 'api' });
      }
    } catch (apiErr) {
      console.error('Game price API fallback error:', apiErr.message);
    }

    return res.json({ price: null, source: 'unavailable' });
  } catch (error) {
    console.error('Game price error:', error.message);
    res.json({ price: null, source: 'error' });
  }
});

// Get market data: merge Kite quote (DB universe) with live WebSocket — WS wins on overlap.
// If we only returned getMarketData() whenever it was non-empty, NIFTY ticks would block REST
// and MCX/user contracts never appeared until full page refresh.
router.get('/market-data', async (req, res) => {
  const wsData = getMarketData() || {};

  if (!zerodhaSession.accessToken) {
    return res.json(wsData);
  }

  const apiKey = process.env.ZERODHA_API_KEY;
  if (!apiKey) {
    return res.json(wsData);
  }

  try {
    const Instrument = (await import('../models/Instrument.js')).default;
    const dbInstruments = await Instrument.find({ isEnabled: true }).select('token symbol exchange').lean();

    const symbolToDbToken = {};
    for (const inst of dbInstruments) {
      if (inst.symbol) {
        const exSym = `${inst.exchange}:${inst.symbol}`;
        symbolToDbToken[exSym] = inst.token;
      }
    }

    // Put MCX first so slice(500) is not "all NSE" and MCX contracts still get REST quotes
    const mcxFirst = [
      ...dbInstruments.filter((i) => i.symbol && i.exchange === 'MCX'),
      ...dbInstruments.filter((i) => i.symbol && i.exchange !== 'MCX'),
    ];
    const instruments = mcxFirst
      .map((i) => `${i.exchange}:${i.symbol}`)
      .slice(0, 500);

    if (instruments.length === 0) {
      return res.json(wsData);
    }

    let fromRest = {};
    try {
      const response = await axios.get(
        `https://api.kite.trade/quote?${instruments.map((i) => `i=${i}`).join('&')}`,
        {
          headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`,
          },
        }
      );

      if (response.data.status === 'success' && response.data.data) {
        for (const [key, quote] of Object.entries(response.data.data)) {
          const dbToken = symbolToDbToken[key];
          const zerodhaToken = quote.instrument_token?.toString();
          const tokenKey = dbToken != null ? String(dbToken) : zerodhaToken;
          if (!tokenKey) continue;
          const rb = quote.depth?.buy?.[0]?.price;
          const ra = quote.depth?.sell?.[0]?.price;
          fromRest[tokenKey] = {
            symbol: quote.tradingsymbol,
            token: tokenKey,
            zerodhaToken: zerodhaToken,
            exchange: key.split(':')[0],
            ltp: quote.last_price,
            rawBid: rb && rb > 0 ? rb : 0,
            rawAsk: ra && ra > 0 ? ra : 0,
            bid: rb && rb > 0 ? rb : quote.last_price,
            ask: ra && ra > 0 ? ra : quote.last_price,
            open: quote.ohlc?.open,
            high: quote.ohlc?.high,
            low: quote.ohlc?.low,
            close: quote.ohlc?.close,
            change: quote.net_change,
            changePercent:
              quote.net_change && quote.ohlc?.close
                ? ((quote.net_change / quote.ohlc.close) * 100).toFixed(2)
                : 0,
            volume: quote.volume,
            lastUpdated: new Date(),
            source: 'rest',
          };
        }
      }
    } catch (restErr) {
      console.error('Zerodha market-data REST merge:', restErr.response?.data || restErr.message);
    }

    // Live stream overwrites same token
    return res.json({ ...fromRest, ...wsData });
  } catch (error) {
    console.error('Zerodha market data error:', error.response?.data || error.message);
    return res.json(wsData);
  }
});

/**
 * Targeted Kite quote for a small list of EXCHANGE:SYMBOL rows (e.g. user MCX watchlist).
 * Use when bulk /market-data omits a contract (first 500 DB rows) or for faster MCX refresh.
 */
router.post('/instruments-quote', protectUser, async (req, res) => {
  try {
    if (!zerodhaSession?.accessToken) {
      return res.json({});
    }
    const apiKey = process.env.ZERODHA_API_KEY;
    if (!apiKey) {
      return res.json({});
    }

    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const seen = new Set();
    const normalized = [];
    for (const it of items.slice(0, 120)) {
      if (!it || typeof it !== 'object') continue;
      const ex = String(it.exchange || '').trim().toUpperCase();
      const sym = String(it.tradingSymbol || it.symbol || '')
        .trim()
        .replace(/"/g, '');
      if (!ex || !sym) continue;
      const kiteK = `${ex}:${sym}`;
      if (seen.has(kiteK)) continue;
      seen.add(kiteK);
      normalized.push({
        exchange: ex,
        tradingsymbol: sym,
        userToken: it.token != null && String(it.token).trim() !== '' ? String(it.token).trim() : null,
      });
    }
    if (normalized.length === 0) {
      return res.json({});
    }

    const iParam = normalized
      .map((n) => `i=${encodeURIComponent(`${n.exchange}:${n.tradingsymbol}`)}`)
      .join('&');
    const response = await axios.get(`https://api.kite.trade/quote?${iParam}`, {
      headers: {
        'X-Kite-Version': '3',
        Authorization: `token ${apiKey}:${zerodhaSession.accessToken}`,
      },
    });

    if (response.data?.status !== 'success' || !response.data.data) {
      return res.json({});
    }

    const symToUserToken = new Map();
    for (const n of normalized) {
      symToUserToken.set(`${n.exchange}:${n.tradingsymbol}`, n.userToken);
    }

    const out = {};
    for (const [kiteKey, quote] of Object.entries(response.data.data)) {
      const zt = quote.instrument_token != null ? String(quote.instrument_token) : '';
      if (!zt) continue;
      const ch = quote.net_change;
      const close = quote.ohlc?.close;
      const changePct =
        ch != null && close
          ? ((ch / close) * 100).toFixed(2)
          : 0;
      const rb = quote.depth?.buy?.[0]?.price;
      const ra = quote.depth?.sell?.[0]?.price;
      const row = {
        symbol: quote.tradingsymbol,
        token: zt,
        zerodhaToken: zt,
        exchange: kiteKey.split(':')[0],
        ltp: quote.last_price,
        rawBid: rb && rb > 0 ? rb : 0,
        rawAsk: ra && ra > 0 ? ra : 0,
        bid: rb && rb > 0 ? rb : quote.last_price,
        ask: ra && ra > 0 ? ra : quote.last_price,
        open: quote.ohlc?.open,
        high: quote.ohlc?.high,
        low: quote.ohlc?.low,
        close: quote.ohlc?.close,
        change: ch,
        changePercent: changePct,
        volume: quote.volume,
        lastUpdated: new Date(),
        source: 'instruments-quote',
      };
      out[zt] = row;
      const ut = symToUserToken.get(kiteKey);
      if (ut && ut !== zt) {
        out[ut] = { ...row, token: ut };
      }
    }
    return res.json(out);
  } catch (e) {
    console.error('instruments-quote:', e.response?.data || e.message);
    return res.json({});
  }
});

/**
 * Users: subscribe Zerodha ticker to instrument_token(s) (e.g. MCX watchlist) so market_tick
 * streams without waiting for an admin "subscribe all". Rate-limits batch size.
 */
router.post('/tick-subscribe', protectUser, async (req, res) => {
  try {
    const raw = req.body?.tokens;
    if (!Array.isArray(raw) || raw.length === 0) {
      return res.status(400).json({ message: 'tokens array required' });
    }
    const nums = [
      ...new Set(
        raw
          .map((t) => parseInt(String(t).trim(), 10))
          .filter((n) => !isNaN(n) && n > 0)
      ),
    ].slice(0, 500);
    if (nums.length === 0) {
      return res.status(400).json({ message: 'no valid token ids' });
    }
    const result = await subscribeTokens(nums);
    return res.json({ ok: true, requested: nums.length, subscribed: result.subscribed, total: result.total });
  } catch (e) {
    console.error('tick-subscribe:', e);
    return res.status(500).json({ message: e?.message || 'subscribe failed' });
  }
});

// Get LTP for specific instruments
router.post('/ltp', async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha' });
    }
    
    const { instruments } = req.body; // Array of "EXCHANGE:SYMBOL"
    
    if (!instruments || !Array.isArray(instruments) || instruments.length === 0) {
      return res.status(400).json({ message: 'Instruments array required' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    const response = await axios.get(
      `https://api.kite.trade/quote/ltp?${instruments.map(i => `i=${i}`).join('&')}`,
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    if (response.data.status === 'success') {
      res.json(response.data.data);
    } else {
      res.status(400).json({ message: response.data.message });
    }
  } catch (error) {
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Download and sync instruments from Zerodha
router.post('/sync-instruments', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    // Download instruments CSV
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const instruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      instruments.push(inst);
    }
    
    // Filter for NFO (F&O) and NSE equity
    const nfoInstruments = instruments.filter(i => 
      i.exchange === 'NFO' && 
      (i.instrument_type === 'FUT' || i.instrument_type === 'CE' || i.instrument_type === 'PE') &&
      (i.name === 'NIFTY' || i.name === 'BANKNIFTY' || i.name === 'FINNIFTY')
    );
    
    const nseEquity = instruments.filter(i => 
      i.exchange === 'NSE' && 
      i.segment === 'NSE' &&
      i.instrument_type === 'EQ'
    );
    
    // Filter for MCX commodities
    const mcxInstruments = instruments.filter(i => 
      i.exchange === 'MCX' && 
      i.instrument_type === 'FUT'
    );
    
    res.json({
      message: 'Instruments fetched successfully',
      total: instruments.length,
      nfo: nfoInstruments.length,
      nseEquity: nseEquity.length,
      mcx: mcxInstruments.length,
      sample: {
        nfo: nfoInstruments.slice(0, 5),
        equity: nseEquity.slice(0, 5),
        mcx: mcxInstruments.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Sync instruments error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Get historical data for charts
router.get('/historical/:instrumentToken', async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.json([]); // Return empty array instead of error
    }
    
    let { instrumentToken } = req.params;
    const { interval, symbol, exchange } = req.query;
    
    // If token is not numeric, try to find it from database
    if (isNaN(parseInt(instrumentToken))) {
      const Instrument = (await import('../models/Instrument.js')).default;
      const inst = await Instrument.findOne({ 
        $or: [
          { symbol: instrumentToken },
          { symbol: symbol },
          { tradingSymbol: instrumentToken }
        ]
      });
      if (inst) {
        instrumentToken = inst.token;
      } else {
        return res.json([]);
      }
    }
    
    // Map frontend interval to Zerodha interval
    const intervalMap = {
      'ONE_MINUTE': 'minute',
      'FIVE_MINUTE': '5minute',
      'FIFTEEN_MINUTE': '15minute',
      'THIRTY_MINUTE': '30minute',
      'ONE_HOUR': '60minute',
      'ONE_DAY': 'day',
      '1': 'minute',
      '5': '5minute',
      '15': '15minute',
      '30': '30minute',
      '60': '60minute',
      'D': 'day',
      '1D': 'day'
    };
    
    const zerodhaInterval = intervalMap[interval] || '15minute';
    
    // Calculate date range based on interval
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    const fromDate = new Date();
    
    if (zerodhaInterval === 'day') {
      fromDate.setFullYear(fromDate.getFullYear() - 1);
    } else if (zerodhaInterval === 'minute') {
      fromDate.setDate(fromDate.getDate() - 5); // 5 days for 1-min
    } else if (zerodhaInterval === '5minute') {
      fromDate.setDate(fromDate.getDate() - 15); // 15 days for 5-min
    } else if (zerodhaInterval === '15minute') {
      fromDate.setDate(fromDate.getDate() - 30); // 30 days for 15-min
    } else if (zerodhaInterval === '30minute' || zerodhaInterval === '60minute') {
      fromDate.setDate(fromDate.getDate() - 60); // 60 days for 30/60-min
    } else {
      fromDate.setDate(fromDate.getDate() - 30);
    }
    const from = fromDate.toISOString().split('T')[0];
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    console.log(`Fetching historical data for token ${instrumentToken}, interval ${zerodhaInterval}, from ${from} to ${to}`);
    
    const response = await axios.get(
      `https://api.kite.trade/instruments/historical/${instrumentToken}/${zerodhaInterval}?from=${from}&to=${to}`,
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    if (response.data.status === 'success' && response.data.data?.candles) {
      // Convert Zerodha format to lightweight-charts format
      const candles = response.data.data.candles.map(c => ({
        time: Math.floor(new Date(c[0]).getTime() / 1000),
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
      }));
      console.log(`Returning ${candles.length} candles for ${instrumentToken}`);
      res.json(candles);
    } else {
      res.json([]);
    }
  } catch (error) {
    console.error('Historical data error:', error.response?.data || error.message);
    res.json([]); // Return empty array on error
  }
});

// Seed MCX instruments with real Zerodha tokens
router.post('/seed-mcx', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha. Please connect first.' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    // Download instruments CSV from Zerodha
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const allInstruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      allInstruments.push(inst);
    }
    
    console.log(`Downloaded ${allInstruments.length} instruments from Zerodha`);
    
    // Now filter for MCX commodities
    const mcxFutures = allInstruments.filter(i => i.exchange === 'MCX' && i.instrument_type === 'FUT');
    
    // Group by tradingsymbol base (GOLD, SILVER, CRUDEOIL, etc.)
    const mcxSymbols = ['GOLD', 'GOLDM', 'SILVER', 'SILVERM', 'CRUDEOIL', 'CRUDEOILM', 'NATURALGAS', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD', 'NICKEL'];
    
    const Instrument = (await import('../models/Instrument.js')).default;
    let added = 0;
    let updated = 0;
    
    const todayYmdSeed = kolkataCalendarDateString(new Date());
    for (const baseSymbol of mcxSymbols) {
      // Nearest **unexpired** contract (IST date) for this base; skip rolled months still in CSV
      const contracts = mcxFutures
        .filter(
          (i) =>
            i.tradingsymbol &&
            i.tradingsymbol.startsWith(baseSymbol) &&
            !i.tradingsymbol.includes('MINI') &&
            i.expiry &&
            kolkataCalendarDateString(new Date(i.expiry)) >= todayYmdSeed
        )
        .sort((a, b) => new Date(a.expiry) - new Date(b.expiry));

      if (contracts.length > 0) {
        const contract = contracts[0];
        
        // Check if exists in database by symbol OR by token
        const existingBySymbol = await Instrument.findOne({ symbol: baseSymbol, exchange: 'MCX' });
        const existingByToken = await Instrument.findOne({ token: contract.instrument_token });
        
        const instrumentData = {
          token: contract.instrument_token,
          symbol: baseSymbol,
          name: contract.name || baseSymbol,
          exchange: 'MCX',
          segment: 'MCX',
          displaySegment: 'MCXFUT',
          instrumentType: 'FUTURES',
          category: 'MCX',
          lotSize: parseInt(contract.lot_size) || 1,
          tickSize: parseFloat(contract.tick_size) || 1,
          expiry: contract.expiry ? new Date(contract.expiry) : null,
          tradingSymbol: contract.tradingsymbol,
          isEnabled: true,
          isFeatured: ['GOLD', 'GOLDM', 'SILVER', 'CRUDEOIL'].includes(baseSymbol)
        };
        
        try {
          if (existingBySymbol) {
            // Update existing by symbol
            await Instrument.findByIdAndUpdate(existingBySymbol._id, instrumentData);
            updated++;
          } else if (existingByToken) {
            // Token exists but different symbol - update it
            await Instrument.findByIdAndUpdate(existingByToken._id, instrumentData);
            updated++;
          } else {
            // Create new
            await Instrument.create(instrumentData);
            added++;
          }
        } catch (dupError) {
          // Handle duplicate key error - try to update instead
          if (dupError.code === 11000) {
            const existingAny = await Instrument.findOne({ 
              $or: [{ token: contract.instrument_token }, { symbol: baseSymbol, exchange: 'MCX' }]
            });
            if (existingAny) {
              await Instrument.findByIdAndUpdate(existingAny._id, { ...instrumentData, token: existingAny.token });
              updated++;
            }
          } else {
            console.error(`Error seeding ${baseSymbol}:`, dupError.message);
          }
        }
      }
    }
    
    // Subscribe to new MCX tokens
    const mcxInstrumentsForSubscribe = await Instrument.find({ exchange: 'MCX', isEnabled: true }).select('token').lean();
    const tokens = mcxInstrumentsForSubscribe.map(i => parseInt(i.token)).filter(t => !isNaN(t));
    
    if (tokens.length > 0) {
      subscribeTokens(tokens);
    }
    
    res.json({
      message: `MCX instruments seeded: ${added} added, ${updated} updated`,
      added,
      updated,
      subscribedTokens: tokens.length
    });
  } catch (error) {
    console.error('Seed MCX error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Sync LOT SIZES only for existing instruments from Zerodha
router.post('/sync-lot-sizes', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha. Please connect first.' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    // Download instruments CSV from Zerodha
    console.log('Downloading instruments from Zerodha for lot size sync...');
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const zerodhaInstruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      zerodhaInstruments.push(inst);
    }
    
    console.log(`Total Zerodha instruments: ${zerodhaInstruments.length}`);
    
    // Create lookup maps by token and by tradingsymbol
    const byToken = {};
    const bySymbol = {};
    for (const inst of zerodhaInstruments) {
      if (inst.instrument_token) {
        const key = inst.instrument_token.toString();
        byToken[key] = inst;
        // Also store numeric key for robustness
        const numKey = Number(inst.instrument_token);
        if (!Number.isNaN(numKey)) {
          byToken[numKey] = inst;
        }
      }
      if (inst.tradingsymbol && inst.exchange) {
        const exchKey = inst.exchange.toUpperCase();
        bySymbol[`${exchKey}:${inst.tradingsymbol}`] = inst;
      }
    }
    
    const Instrument = (await import('../models/Instrument.js')).default;
    
    // MCX lot sizes - fallback when Zerodha doesn't provide correct lot size
    const MCX_LOT_SIZES = {
      'GOLDM': 10, 'GOLDGUINEA': 1, 'GOLDPETAL': 1, 'GOLD': 100,
      'SILVERM': 5, 'SILVERMIC': 1, 'SILVER': 30,
      'CRUDEOILM': 10, 'CRUDEOIL': 100,
      'NATURALGAS': 1250, 'COPPER': 2500, 'ZINC': 5000,
      'ALUMINIUM': 5000, 'LEAD': 5000, 'NICKEL': 1500,
      'MENTHAOIL': 360, 'COTTON': 25, 'CPO': 10,
    };
    
    // Helper to get correct lot size with MCX fallback
    const getCorrectLotSize = (symbol, exchange, zerodhaLotSize) => {
      const parsedLot = parseInt(zerodhaLotSize);
      // If Zerodha provides valid lot size > 1, use it
      if (parsedLot && parsedLot > 1) return parsedLot;
      // For MCX, use hardcoded fallback
      if (exchange === 'MCX') {
        const upperSymbol = (symbol || '').toUpperCase();
        const sortedKeys = Object.keys(MCX_LOT_SIZES).sort((a, b) => b.length - a.length);
        for (const key of sortedKeys) {
          if (upperSymbol.includes(key)) return MCX_LOT_SIZES[key];
        }
      }
      return parsedLot || 1;
    };
    
    // Get all instruments from database
    const dbInstruments = await Instrument.find({});
    console.log(`Database instruments: ${dbInstruments.length}`);
    
    let updated = 0;
    let notFound = 0;
    const updateResults = [];
    
    for (const dbInst of dbInstruments) {
      // Try to find matching Zerodha instrument (token stored as string/number)
      const tokenKey = dbInst.token?.toString();
      let zerodhaInst = tokenKey ? (byToken[tokenKey] || byToken[Number(tokenKey)]) : null;
      
      // If not found by token, try by symbol/tradingSymbol (force uppercase exchange)
      const exchKey = dbInst.exchange ? dbInst.exchange.toUpperCase() : '';
      if (!zerodhaInst && dbInst.symbol && exchKey) {
        zerodhaInst = bySymbol[`${exchKey}:${dbInst.symbol}`];
      }
      
      // Also try tradingSymbol
      if (!zerodhaInst && dbInst.tradingSymbol && exchKey) {
        zerodhaInst = bySymbol[`${exchKey}:${dbInst.tradingSymbol}`];
      }
      
      // Try name as last resort
      if (!zerodhaInst && dbInst.name && exchKey) {
        zerodhaInst = bySymbol[`${exchKey}:${dbInst.name}`];
      }
      
      if (zerodhaInst) {
        const newLotSize = getCorrectLotSize(dbInst.symbol, dbInst.exchange, zerodhaInst.lot_size);
        const newTickSize = parseFloat(zerodhaInst.tick_size) || 0.05;
        
        // Only update if lot size changed
        if (dbInst.lotSize !== newLotSize || dbInst.tickSize !== newTickSize) {
          await Instrument.findByIdAndUpdate(dbInst._id, {
            lotSize: newLotSize,
            tickSize: newTickSize,
            // Also update token if it changed (for F&O contracts that roll over)
            token: zerodhaInst.instrument_token || dbInst.token
          });
          updated++;
          updateResults.push({
            symbol: dbInst.symbol,
            exchange: dbInst.exchange,
            oldLotSize: dbInst.lotSize,
            newLotSize: newLotSize
          });
          
          if (updated <= 5) {
            console.log('Lot size updated', {
              symbol: dbInst.symbol,
              exchange: dbInst.exchange,
              token: dbInst.token,
              zToken: zerodhaInst.instrument_token,
              oldLotSize: dbInst.lotSize,
              newLotSize,
              oldTickSize: dbInst.tickSize,
              newTickSize
            });
          }
        }
      } else {
        notFound++;
        if (notFound <= 5) {
          console.log('No Zerodha match for', {
            symbol: dbInst.symbol,
            tradingSymbol: dbInst.tradingSymbol,
            name: dbInst.name,
            exchange: dbInst.exchange,
            token: dbInst.token
          });
        }
      }
    }
    
    console.log(`Lot sizes synced: ${updated} updated, ${notFound} not found in Zerodha`);
    
    res.json({
      message: `Lot sizes synced successfully`,
      updated,
      notFound,
      total: dbInstruments.length,
      updates: updateResults.slice(0, 20) // Show first 20 updates
    });
  } catch (error) {
    console.error('Sync lot sizes error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Reset lot sizes in DB (for re-sync)
router.post('/reset-lot-sizes', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const Instrument = (await import('../models/Instrument.js')).default;
    const result = await Instrument.updateMany(
      { exchange: { $in: ['MCX', 'NFO', 'NSE'] } },
      { $set: { lotSize: null } }
    );
    res.json({ message: 'Lot sizes reset. Run Sync Lot Sizes next.', modified: result.modifiedCount });
  } catch (error) {
    console.error('Reset lot sizes error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Fix MCX lot sizes - updates all MCX instruments with correct lot sizes
router.post('/fix-mcx-lot-sizes', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const Instrument = (await import('../models/Instrument.js')).default;
    
    // MCX lot size mapping - mini variants first
    const mcxLotSizes = [
      { pattern: /GOLDM/i, lotSize: 10 },
      { pattern: /GOLDGUINEA/i, lotSize: 1 },
      { pattern: /GOLDPETAL/i, lotSize: 1 },
      { pattern: /SILVERM/i, lotSize: 5 },
      { pattern: /SILVERMIC/i, lotSize: 1 },
      { pattern: /CRUDEOILM/i, lotSize: 10 },
      { pattern: /GOLD/i, lotSize: 100 },
      { pattern: /SILVER/i, lotSize: 30 },
      { pattern: /CRUDEOIL|CRUDE/i, lotSize: 100 },
      { pattern: /NATURALGAS|NATGAS/i, lotSize: 1250 },
      { pattern: /COPPER/i, lotSize: 2500 },
      { pattern: /ZINC/i, lotSize: 5000 },
      { pattern: /ALUMINIUM|ALUMINUM/i, lotSize: 5000 },
      { pattern: /LEAD/i, lotSize: 5000 },
      { pattern: /NICKEL/i, lotSize: 1500 },
    ];
    
    const mcxInstruments = await Instrument.find({ exchange: 'MCX' });
    let updated = 0;
    const updates = [];
    
    for (const inst of mcxInstruments) {
      const symbolOrName = inst.symbol || inst.name || inst.tradingSymbol || '';
      let newLotSize = null;
      
      for (const { pattern, lotSize } of mcxLotSizes) {
        if (pattern.test(symbolOrName)) {
          newLotSize = lotSize;
          break;
        }
      }
      
      if (newLotSize && inst.lotSize !== newLotSize) {
        await Instrument.findByIdAndUpdate(inst._id, { lotSize: newLotSize });
        updates.push({ symbol: inst.symbol, oldLotSize: inst.lotSize, newLotSize });
        updated++;
      }
    }
    
    res.json({ 
      message: `Fixed MCX lot sizes`, 
      total: mcxInstruments.length,
      updated,
      samples: updates.slice(0, 20)
    });
  } catch (error) {
    console.error('Fix MCX lot sizes error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Quick diagnostics for lot sizes (no writes)
router.get('/lot-size-diagnostics', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const Instrument = (await import('../models/Instrument.js')).default;
    const instruments = await Instrument.find({}).lean();
    
    const fno = instruments.filter(i => i.exchange === 'NFO');
    const nse = instruments.filter(i => i.exchange === 'NSE');
    const mcx = instruments.filter(i => i.exchange === 'MCX');
    
    const badFno = fno.filter(i => !i.lotSize || i.lotSize <= 1);
    const badNse = nse.filter(i => !i.lotSize || i.lotSize <= 1);
    
    const sampleByName = (name) => fno
      .filter(i => (i.name || '').toUpperCase().includes(name))
      .slice(0, 5)
      .map(i => ({ symbol: i.symbol, tradingSymbol: i.tradingSymbol, lotSize: i.lotSize, token: i.token }));
    
    res.json({
      summary: {
        total: instruments.length,
        fno: fno.length,
        nse: nse.length,
        mcx: mcx.length,
        badFno: badFno.length,
        badNse: badNse.length
      },
      lotSizeDistinct: {
        fno: Array.from(new Set(fno.map(i => i.lotSize))).sort((a, b) => a - b),
        nse: Array.from(new Set(nse.map(i => i.lotSize))).sort((a, b) => a - b),
        mcx: Array.from(new Set(mcx.map(i => i.lotSize))).sort((a, b) => a - b)
      },
      samples: {
        NIFTY: sampleByName('NIFTY'),
        BANKNIFTY: sampleByName('BANKNIFTY'),
        FINNIFTY: sampleByName('FINNIFTY'),
        MIDCPNIFTY: sampleByName('MIDCPNIFTY')
      },
      badSamples: {
        fno: badFno.slice(0, 10).map(i => ({
          symbol: i.symbol,
          tradingSymbol: i.tradingSymbol,
          exchange: i.exchange,
          lotSize: i.lotSize,
          token: i.token
        })),
        nse: badNse.slice(0, 10).map(i => ({
          symbol: i.symbol,
          tradingSymbol: i.tradingSymbol,
          exchange: i.exchange,
          lotSize: i.lotSize,
          token: i.token
        }))
      }
    });
  } catch (error) {
    console.error('Lot size diagnostics error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Sync ALL instruments from Zerodha and save to database
router.post('/sync-all-instruments', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha. Please connect first.' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    // Download instruments CSV from Zerodha
    console.log('Downloading instruments from Zerodha...');
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const allInstruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      allInstruments.push(inst);
    }
    
    console.log(`Total instruments from Zerodha: ${allInstruments.length}`);
    
    const Instrument = (await import('../models/Instrument.js')).default;
    
    let added = 0;
    let updated = 0;
    let errors = 0;
    
    // 1. NSE Equity (Stocks) - Top 200 by volume/popularity
    const nseEquity = allInstruments.filter(i => 
      i.exchange === 'NSE' && 
      i.segment === 'NSE' &&
      i.instrument_type === 'EQ'
    );
    
    // Popular stocks list (Nifty 50 + Nifty Next 50 + popular ones)
    const popularStocks = [
      'RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'HINDUNILVR', 'SBIN', 'BHARTIARTL',
      'KOTAKBANK', 'ITC', 'LT', 'AXISBANK', 'ASIANPAINT', 'MARUTI', 'TITAN', 'BAJFINANCE',
      'SUNPHARMA', 'ULTRACEMCO', 'NESTLEIND', 'WIPRO', 'HCLTECH', 'TATAMOTORS', 'POWERGRID',
      'NTPC', 'ONGC', 'JSWSTEEL', 'TATASTEEL', 'ADANIENT', 'ADANIPORTS', 'COALINDIA',
      'BAJAJFINSV', 'TECHM', 'GRASIM', 'INDUSINDBK', 'HINDALCO', 'DRREDDY', 'CIPLA',
      'EICHERMOT', 'DIVISLAB', 'BPCL', 'BRITANNIA', 'HEROMOTOCO', 'APOLLOHOSP', 'SBILIFE',
      'HDFCLIFE', 'TATACONSUM', 'UPL', 'SHREECEM', 'BAJAJ-AUTO', 'M&M',
      // Additional popular stocks
      'ZOMATO', 'PAYTM', 'NYKAA', 'DELHIVERY', 'IRCTC', 'TATAELXSI', 'PERSISTENT',
      'COFORGE', 'MPHASIS', 'LTIM', 'PIIND', 'AARTIIND', 'DEEPAKNTR', 'NAVINFLUOR',
      'AUROPHARMA', 'BIOCON', 'LUPIN', 'TORNTPHARM', 'ALKEM', 'IPCALAB',
      'BANKBARODA', 'PNB', 'CANBK', 'UNIONBANK', 'IOB', 'FEDERALBNK', 'IDFCFIRSTB',
      'VEDL', 'NMDC', 'SAIL', 'JINDALSTEL', 'NATIONALUM', 'HINDZINC',
      'TATAPOWER', 'ADANIGREEN', 'ADANIPOWER', 'NHPC', 'SJVN', 'IRFC',
      'HAL', 'BEL', 'BHEL', 'L&TFH', 'RECLTD', 'PFC',
      'INDIGO', 'TRENT', 'DMART', 'PAGEIND', 'MANYAVAR', 'ABFRL',
      'PIDILITIND', 'BERGEPAINT', 'KANSAINER', 'AKZONOBEL',
      'GODREJCP', 'DABUR', 'MARICO', 'COLPAL', 'EMAMILTD',
      'HAVELLS', 'VOLTAS', 'BLUESTARCO', 'CROMPTON', 'ORIENTELEC',
      'POLYCAB', 'KEI', 'FINOLEX', 'AMBER',
      'DLF', 'GODREJPROP', 'OBEROIRLTY', 'PRESTIGE', 'BRIGADE', 'SOBHA',
      'ZYDUSLIFE', 'GLENMARK', 'NATCOPHARM', 'LAURUSLABS', 'GRANULES'
    ];
    
    for (const stock of nseEquity) {
      if (popularStocks.includes(stock.tradingsymbol)) {
        try {
          const existing = await Instrument.findOne({ token: stock.instrument_token });
          const instrumentData = {
            token: stock.instrument_token,
            symbol: stock.tradingsymbol,
            name: stock.name || stock.tradingsymbol,
            exchange: 'NSE',
            segment: 'EQUITY',
            instrumentType: 'STOCK',
            category: 'STOCKS',
            lotSize: parseInt(stock.lot_size) || 1,
            tickSize: parseFloat(stock.tick_size) || 0.05,
            isEnabled: true,
            isFeatured: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].includes(stock.tradingsymbol)
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
        } catch (e) {
          errors++;
        }
      }
    }
    
    // 2. NSE Indices
    const indices = allInstruments.filter(i => 
      i.exchange === 'NSE' && i.segment === 'INDICES'
    );
    
    const popularIndices = ['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'NIFTY MIDCAP 50', 'NIFTY IT', 'INDIA VIX'];
    
    for (const idx of indices) {
      if (popularIndices.includes(idx.tradingsymbol)) {
        try {
          const existing = await Instrument.findOne({ token: idx.instrument_token });
          const instrumentData = {
            token: idx.instrument_token,
            symbol: idx.tradingsymbol.replace(' ', ''),
            name: idx.tradingsymbol,
            exchange: 'NSE',
            segment: 'EQUITY',
            instrumentType: 'INDEX',
            category: 'INDICES',
            lotSize: 1,
            isEnabled: true,
            isFeatured: true
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
        } catch (e) {
          errors++;
        }
      }
    }
    
    // 3. NFO - Futures and Options (current week + next week expiry)
    const nfoFutures = allInstruments.filter(i => 
      i.exchange === 'NFO' && 
      i.instrument_type === 'FUT' &&
      (i.name === 'NIFTY' || i.name === 'BANKNIFTY' || i.name === 'FINNIFTY')
    );
    
    // Get nearest 2 expiries for futures
    const sortedFutures = nfoFutures.sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    const nearestFutures = sortedFutures.slice(0, 6); // 2 expiries x 3 indices
    
    for (const fut of nearestFutures) {
      try {
        const existing = await Instrument.findOne({ token: fut.instrument_token });
        const instrumentData = {
          token: fut.instrument_token,
          symbol: fut.tradingsymbol,
          name: `${fut.name} FUT`,
          exchange: 'NFO',
          segment: 'FNO',
          instrumentType: 'FUTURES',
          category: fut.name,
          lotSize: parseInt(fut.lot_size) || 25,
          tickSize: parseFloat(fut.tick_size) || 0.05,
          expiry: new Date(fut.expiry),
          tradingSymbol: fut.tradingsymbol,
          isEnabled: true,
          isFeatured: true
        };
        
        if (existing) {
          await Instrument.findByIdAndUpdate(existing._id, instrumentData);
          updated++;
        } else {
          await Instrument.create(instrumentData);
          added++;
        }
      } catch (e) {
        errors++;
      }
    }
    
    // 4. NFO Options - ATM strikes for current week
    const nfoOptions = allInstruments.filter(i => 
      i.exchange === 'NFO' && 
      (i.instrument_type === 'CE' || i.instrument_type === 'PE') &&
      (i.name === 'NIFTY' || i.name === 'BANKNIFTY')
    );
    
    // Get current week expiry options
    const today = new Date();
    const currentWeekOptions = nfoOptions.filter(opt => {
      const expiry = new Date(opt.expiry);
      const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 7;
    });
    
    // NIFTY ATM strikes (around 24000-24500)
    const niftyStrikes = [23500, 23600, 23700, 23800, 23900, 24000, 24100, 24200, 24300, 24400, 24500, 24600, 24700, 24800, 24900, 25000];
    // BANKNIFTY ATM strikes (around 51000-52000)
    const bnStrikes = [50500, 50700, 50900, 51000, 51100, 51300, 51500, 51700, 51900, 52000, 52100, 52300, 52500];
    
    for (const opt of currentWeekOptions) {
      const strike = parseFloat(opt.strike);
      const isNiftyATM = opt.name === 'NIFTY' && niftyStrikes.includes(strike);
      const isBNATM = opt.name === 'BANKNIFTY' && bnStrikes.includes(strike);
      
      if (isNiftyATM || isBNATM) {
        try {
          const existing = await Instrument.findOne({ token: opt.instrument_token });
          const instrumentData = {
            token: opt.instrument_token,
            symbol: opt.tradingsymbol,
            name: `${opt.name} ${strike} ${opt.instrument_type}`,
            exchange: 'NFO',
            segment: 'FNO',
            instrumentType: 'OPTIONS',
            optionType: opt.instrument_type,
            strike: strike,
            category: opt.name,
            lotSize: parseInt(opt.lot_size) || 25,
            tickSize: parseFloat(opt.tick_size) || 0.05,
            expiry: new Date(opt.expiry),
            tradingSymbol: opt.tradingsymbol,
            isEnabled: true
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
        } catch (e) {
          errors++;
        }
      }
    }
    
    // 5. MCX Commodities
    const mcxFutures = allInstruments.filter(i => 
      i.exchange === 'MCX' && i.instrument_type === 'FUT'
    );
    
    const mcxSymbols = ['GOLD', 'GOLDM', 'SILVER', 'SILVERM', 'CRUDEOIL', 'CRUDEOILM', 'NATURALGAS', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD', 'NICKEL'];
    
    for (const baseSymbol of mcxSymbols) {
      const contracts = mcxFutures.filter(i => 
        i.tradingsymbol && i.tradingsymbol.startsWith(baseSymbol)
      ).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
      
      if (contracts.length > 0) {
        const contract = contracts[0]; // Nearest expiry
        try {
          const existing = await Instrument.findOne({ symbol: baseSymbol, exchange: 'MCX' });
          const instrumentData = {
            token: contract.instrument_token,
            symbol: baseSymbol,
            name: contract.name || baseSymbol,
            exchange: 'MCX',
            segment: 'MCX',
            instrumentType: 'FUTURES',
            category: 'MCX',
            lotSize: parseInt(contract.lot_size) || 1,
            tickSize: parseFloat(contract.tick_size) || 1,
            expiry: new Date(contract.expiry),
            tradingSymbol: contract.tradingsymbol,
            isEnabled: true,
            isFeatured: ['GOLD', 'GOLDM', 'SILVER', 'CRUDEOIL'].includes(baseSymbol)
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
        } catch (e) {
          errors++;
        }
      }
    }
    
    // Subscribe to all new tokens
    const allDbInstruments = await Instrument.find({ isEnabled: true }).select('token').lean();
    const tokens = allDbInstruments.map(i => parseInt(i.token)).filter(t => !isNaN(t));
    
    if (tokens.length > 0) {
      subscribeTokens(tokens);
    }
    
    res.json({
      message: `Instruments synced from Zerodha`,
      added,
      updated,
      errors,
      totalInDatabase: await Instrument.countDocuments(),
      subscribedTokens: tokens.length
    });
  } catch (error) {
    console.error('Sync all instruments error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Reset instruments and sync fresh from Zerodha
router.post('/reset-and-sync', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha. Please connect first.' });
    }
    
    const Instrument = (await import('../models/Instrument.js')).default;

    // Preserve super-admin / per-instrument config before wipe (tradingDefaults, visibility, circuit, etc.)
    const existingPreReset = await Instrument.find({}).lean();
    const preserveByToken = new Map();
    const preserveByExchangeSymbol = new Map();
    for (const doc of existingPreReset) {
      if (doc.token != null) preserveByToken.set(String(doc.token), doc);
      const exSym = exchangeSymbolPreserveKey(doc);
      if (exSym) preserveByExchangeSymbol.set(exSym, doc);
    }
    const withTradingDefaults = existingPreReset.filter(
      (d) => d?.tradingDefaults != null && typeof d.tradingDefaults === 'object'
    ).length;

    const deleteResult = await Instrument.deleteMany({});
    console.log(
      `Deleted ${deleteResult.deletedCount} instruments; preserved admin snapshots: ${preserveByToken.size} by token, ${preserveByExchangeSymbol.size} by exchange+symbol (${withTradingDefaults} rows had tradingDefaults)`
    );

    const createFromKiteDoc = (kiteDoc) =>
      Instrument.create(
        mergeInstrumentPreservedFromBackup(kiteDoc, preserveByToken, preserveByExchangeSymbol)
      );
    
    // Now call sync-all-nse logic
    const apiKey = process.env.ZERODHA_API_KEY;
    
    console.log('Downloading ALL instruments from Zerodha...');
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const allInstruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      allInstruments.push(inst);
    }
    
    console.log(`Total instruments from Zerodha: ${allInstruments.length}`);
    
    // Debug: Log sample instrument and available fields
    if (allInstruments.length > 0) {
      console.log('CSV Headers:', headers);
      console.log('Sample instrument:', JSON.stringify(allInstruments[0]));
      
      // Check what exchanges exist
      const exchanges = [...new Set(allInstruments.map(i => i.exchange))];
      console.log('Available exchanges:', exchanges);
      
      // Check NSE instruments
      const nseCount = allInstruments.filter(i => i.exchange === 'NSE').length;
      console.log('NSE instruments count:', nseCount);
    }
    
    let added = 0;
    let errors = 0;
    const counts = { 'NSE-EQ': 0, 'NSEFUT': 0, 'NSEOPT': 0, 'MCXFUT': 0, 'MCXOPT': 0, 'BSE-FUT': 0, 'BSE-OPT': 0 };
    
    // 1. NSE EQUITY (Stocks)
    const nseEquity = allInstruments.filter(i => 
      i.exchange === 'NSE' && i.segment === 'NSE' && i.instrument_type === 'EQ'
    );
    console.log(`Found ${nseEquity.length} NSE equity instruments`);
    
    for (const stock of nseEquity) {
      try {
        await createFromKiteDoc({
          token: stock.instrument_token,
          symbol: stock.tradingsymbol,
          name: stock.name || stock.tradingsymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          displaySegment: 'NSE-EQ',
          instrumentType: 'STOCK',
          category: 'STOCKS',
          tradingSymbol: stock.tradingsymbol,
          lotSize: parseInt(stock.lot_size) || 1,
          tickSize: parseFloat(stock.tick_size) || 0.05,
          isEnabled: true,
          isFeatured: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].includes(stock.tradingsymbol),
          sortOrder: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].includes(stock.tradingsymbol) ? 1 : 100
        });
        added++;
        counts['NSE-EQ']++;
      } catch (e) { errors++; }
    }
    
    // 2. NSE INDICES
    const indices = allInstruments.filter(i => i.exchange === 'NSE' && i.segment === 'INDICES');
    
    for (const idx of indices) {
      try {
        const isMajorIndex = ['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'INDIA VIX'].includes(idx.tradingsymbol);
        await createFromKiteDoc({
          token: idx.instrument_token,
          symbol: idx.tradingsymbol.replace(/ /g, ''),
          name: idx.tradingsymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          displaySegment: 'NSE-EQ',
          instrumentType: 'INDEX',
          category: 'INDICES',
          tradingSymbol: idx.tradingsymbol,
          lotSize: 1,
          isEnabled: true,
          isFeatured: isMajorIndex,
          sortOrder: isMajorIndex ? 0 : 50
        });
        added++;
        counts['NSE-EQ']++;
      } catch (e) { errors++; }
    }
    
    // 3. NSE F&O - ALL Futures (Index + Stock Futures)
    // Debug: Check what exchanges exist in the data
    const exchanges = [...new Set(allInstruments.map(i => i.exchange))];
    console.log('Available exchanges:', exchanges);
    
    // Debug: Check sample NFO instrument
    const sampleNfo = allInstruments.find(i => i.exchange === 'NFO');
    if (sampleNfo) {
      console.log('Sample NFO instrument:', JSON.stringify(sampleNfo).substring(0, 500));
    } else {
      console.log('No NFO instruments found in data!');
    }
    
    const allNfoFutures = allInstruments.filter(i => 
      i.exchange === 'NFO' && i.instrument_type === 'FUT'
    ).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    console.log(`Found ${allNfoFutures.length} total NFO futures`);
    
    // Helper to format expiry month
    const getExpiryMonth = (expiry) => {
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const d = new Date(expiry);
      return months[d.getMonth()];
    };
    
    const indexNames = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];
    
    // Save ALL NFO futures directly (not grouped)
    console.log(`Saving ${allNfoFutures.length} NFO futures...`);
    let nfoErrors = [];
    let nfoSaved = 0;
    
    // Only save first 3 expiries per underlying
    const savedByName = {};
    for (const fut of allNfoFutures) {
      const baseName = fut.name || 'UNKNOWN';
      if (!savedByName[baseName]) savedByName[baseName] = 0;
      if (savedByName[baseName] >= 3) continue; // Skip if already have 3 expiries
      
      try {
        const expiryMonth = getExpiryMonth(fut.expiry);
        const isIndex = indexNames.includes(baseName);
        await createFromKiteDoc({
          token: String(fut.instrument_token),
          symbol: fut.tradingsymbol,
          name: `${baseName} ${expiryMonth} FUT`,
          exchange: 'NFO',
          segment: 'FNO',
          displaySegment: 'NSEFUT',
          instrumentType: 'FUTURES',
          category: isIndex ? baseName : 'STOCKS',
          tradingSymbol: fut.tradingsymbol,
          lotSize: parseInt(fut.lot_size) || 25,
          tickSize: parseFloat(fut.tick_size) || 0.05,
          expiry: new Date(fut.expiry),
          isEnabled: true,
          isFeatured: isIndex,
          sortOrder: isIndex ? 0 : 50
        });
        savedByName[baseName]++;
        nfoSaved++;
        added++;
        counts['NSEFUT']++;
      } catch (e) { 
        errors++; 
        if (nfoErrors.length < 5) nfoErrors.push(`${baseName}: ${e.message}`);
      }
    }
    console.log(`NFO Futures: Saved ${nfoSaved}, Errors: ${nfoErrors.length}`);
    if (nfoErrors.length > 0) console.log('NFO Futures errors:', nfoErrors);
    
    // 3b. NSE F&O Options (CE/PE) - ALL Options (Index + Stock)
    const allNfoOptions = allInstruments.filter(i => 
      i.exchange === 'NFO' && (i.instrument_type === 'CE' || i.instrument_type === 'PE')
    );
    
    // Group ALL options by name and expiry
    const optionsByNameExpiry = {};
    for (const opt of allNfoOptions) {
      if (!optionsByNameExpiry[opt.name]) optionsByNameExpiry[opt.name] = {};
      if (!optionsByNameExpiry[opt.name][opt.expiry]) optionsByNameExpiry[opt.name][opt.expiry] = [];
      optionsByNameExpiry[opt.name][opt.expiry].push(opt);
    }
    
    // Get nearest 2 expiries for each underlying and add strikes around ATM
    for (const [name, expiries] of Object.entries(optionsByNameExpiry)) {
      const isIndex = indexNames.includes(name);
      const sortedExpiries = Object.keys(expiries).sort((a, b) => new Date(a) - new Date(b));
      const nearestExpiries = sortedExpiries.slice(0, 2); // Get 2 nearest expiries
      
      for (const expiry of nearestExpiries) {
        const options = expiries[expiry];
        const expiryMonth = getExpiryMonth(expiry);
        
        // Sort by strike and get strikes around ATM
        const strikes = [...new Set(options.map(o => parseFloat(o.strike)))].sort((a, b) => a - b);
        const midIndex = Math.floor(strikes.length / 2);
        // For indices get 10 strikes, for stocks get 5 strikes around ATM
        const strikeRange = isIndex ? 5 : 3;
        const selectedStrikes = strikes.slice(Math.max(0, midIndex - strikeRange), midIndex + strikeRange);
        
        for (const opt of options) {
          if (!selectedStrikes.includes(parseFloat(opt.strike))) continue;
          
          try {
            await createFromKiteDoc({
              token: opt.instrument_token,
              symbol: opt.tradingsymbol,
              name: `${opt.name} ${expiryMonth} ${opt.strike} ${opt.instrument_type}`,
              exchange: 'NFO',
              segment: 'FNO',
              displaySegment: 'NSEOPT',
              instrumentType: 'OPTIONS',
              optionType: opt.instrument_type,
              strike: parseFloat(opt.strike),
              category: isIndex ? opt.name : 'STOCKS',
              tradingSymbol: opt.tradingsymbol,
              lotSize: parseInt(opt.lot_size) || 25,
              tickSize: parseFloat(opt.tick_size) || 0.05,
              expiry: new Date(opt.expiry),
              isEnabled: true,
              isFeatured: false,
              sortOrder: opt.instrument_type === 'CE' ? 10 : 20
            });
            added++;
            counts['NSEOPT']++;
          } catch (e) { errors++; }
        }
      }
    }
    
    // 4. MCX COMMODITIES — one row per **tradingSymbol base** (CRUDEOIL, not "CRUDE OIL" name); front month = earliest **active** expiry
    const mcxFutures = allInstruments.filter(i => i.exchange === 'MCX' && i.instrument_type === 'FUT');
    const todayYmd = kolkataCalendarDateString(new Date());
    const mcxFuturesActive = mcxFutures.filter((fut) => {
      if (!fut.expiry) return false;
      const e = new Date(fut.expiry);
      if (Number.isNaN(e.getTime())) return false;
      return kolkataCalendarDateString(e) >= todayYmd;
    });
    const mcxBySymbol = {};
    for (const fut of mcxFuturesActive) {
      const baseSymbol = mcxFuturesBaseFromKite(fut.tradingsymbol);
      if (!baseSymbol) continue;
      if (
        !mcxBySymbol[baseSymbol] ||
        new Date(fut.expiry) < new Date(mcxBySymbol[baseSymbol].expiry)
      ) {
        mcxBySymbol[baseSymbol] = fut;
      }
    }
    
    const mcxPriority = ['GOLD', 'GOLDM', 'SILVER', 'SILVERM', 'CRUDEOIL', 'NATURALGAS', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD', 'NICKEL'];
    
    // MCX lot sizes - fallback when Zerodha doesn't provide correct lot size
    const MCX_LOT_SIZES = {
      'GOLDM': 10,
      'GOLDGUINEA': 1,
      'GOLDPETAL': 1,
      'GOLD': 100,
      'SILVERM': 5,
      'SILVERMIC': 1,
      'SILVER': 30,
      'CRUDEOILM': 10,
      'CRUDEOIL': 100,
      'NATURALGAS': 1250,
      'COPPER': 2500,
      'ZINC': 5000,
      'ALUMINIUM': 5000,
      'LEAD': 5000,
      'NICKEL': 1500,
      'MENTHAOIL': 360,
      'COTTON': 25,
      'CPO': 10,
    };
    
    // Helper to get MCX lot size
    const getMcxLotSize = (symbol, zerodhaLotSize) => {
      const parsedLot = parseInt(zerodhaLotSize);
      // If Zerodha provides a valid lot size > 1, use it
      if (parsedLot && parsedLot > 1) return parsedLot;
      // Otherwise use hardcoded fallback
      const upperSymbol = symbol?.toUpperCase() || '';
      // Check mini variants first (longer names)
      const sortedKeys = Object.keys(MCX_LOT_SIZES).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        if (upperSymbol.includes(key)) return MCX_LOT_SIZES[key];
      }
      return 1;
    };
    
    for (const [baseSymbol, contract] of Object.entries(mcxBySymbol)) {
      try {
        const priorityIndex = mcxPriority.indexOf(baseSymbol);
        const lotSize = getMcxLotSize(baseSymbol, contract.lot_size);
        await createFromKiteDoc({
          token: contract.instrument_token,
          symbol: baseSymbol,
          name: contract.name || baseSymbol,
          exchange: 'MCX',
          segment: 'MCX',
          displaySegment: 'MCXFUT',
          instrumentType: 'FUTURES',
          category: 'MCX',
          tradingSymbol: contract.tradingsymbol,
          lotSize: lotSize,
          tickSize: parseFloat(contract.tick_size) || 1,
          expiry: new Date(contract.expiry),
          isEnabled: true,
          isFeatured: priorityIndex >= 0 && priorityIndex < 5,
          sortOrder: priorityIndex >= 0 ? priorityIndex : 100
        });
        added++;
        counts['MCXFUT']++;
      } catch (e) { errors++; }
    }
    
    // 4b. MCX OPTIONS
    const mcxOptions = allInstruments.filter(i => 
      i.exchange === 'MCX' && (i.instrument_type === 'CE' || i.instrument_type === 'PE')
    );
    
    console.log(`Found ${mcxOptions.length} MCX options`);
    
    // Group MCX options by name and expiry (uses getMcxLotSize defined above)
    const mcxOptionsByNameExpiry = {};
    for (const opt of mcxOptions) {
      if (!mcxOptionsByNameExpiry[opt.name]) mcxOptionsByNameExpiry[opt.name] = {};
      if (!mcxOptionsByNameExpiry[opt.name][opt.expiry]) mcxOptionsByNameExpiry[opt.name][opt.expiry] = [];
      mcxOptionsByNameExpiry[opt.name][opt.expiry].push(opt);
    }
    
    // Get nearest 2 expiries for each underlying and add strikes around ATM
    for (const [name, expiries] of Object.entries(mcxOptionsByNameExpiry)) {
      const sortedExpiries = Object.keys(expiries).sort((a, b) => new Date(a) - new Date(b));
      const nearestExpiries = sortedExpiries.slice(0, 2); // Get 2 nearest expiries
      
      for (const expiry of nearestExpiries) {
        const options = expiries[expiry];
        
        // Sort by strike and get strikes around ATM
        const strikes = [...new Set(options.map(o => parseFloat(o.strike)))].sort((a, b) => a - b);
        const midIndex = Math.floor(strikes.length / 2);
        // Get 5 strikes around ATM
        const selectedStrikes = strikes.slice(Math.max(0, midIndex - 3), midIndex + 3);
        
        for (const opt of options) {
          if (!selectedStrikes.includes(parseFloat(opt.strike))) continue;
          
          try {
            await createFromKiteDoc({
              token: opt.instrument_token,
              symbol: opt.tradingsymbol,
              name: `${opt.name} ${opt.strike} ${opt.instrument_type}`,
              exchange: 'MCX',
              segment: 'MCX',
              displaySegment: 'MCXOPT',
              instrumentType: 'OPTIONS',
              optionType: opt.instrument_type,
              strike: parseFloat(opt.strike),
              category: 'MCX',
              tradingSymbol: opt.tradingsymbol,
              lotSize: getMcxLotSize(opt.name, opt.lot_size),
              tickSize: parseFloat(opt.tick_size) || 1,
              expiry: new Date(opt.expiry),
              isEnabled: true,
              isFeatured: false,
              sortOrder: opt.instrument_type === 'CE' ? 10 : 20
            });
            added++;
            counts['MCXOPT']++;
          } catch (e) { errors++; }
        }
      }
    }
    
    // 5. BSE F&O Futures
    const bseIndexNames = ['SENSEX', 'BANKEX'];
    const bseFutures = allInstruments.filter(i => {
      if (i.exchange !== 'BFO' || i.instrument_type !== 'FUT') return false;
      return bseIndexNames.some(idx => 
        i.name === idx || 
        i.tradingsymbol?.startsWith(idx) ||
        i.name?.toUpperCase() === idx
      );
    }).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    console.log(`Found ${bseFutures.length} BFO futures`);
    
    const bseFuturesByName = {};
    for (const fut of bseFutures) {
      if (!bseFuturesByName[fut.name]) bseFuturesByName[fut.name] = [];
      if (bseFuturesByName[fut.name].length < 2) bseFuturesByName[fut.name].push(fut);
    }
    
    for (const [name, futures] of Object.entries(bseFuturesByName)) {
      for (const fut of futures) {
        try {
          await createFromKiteDoc({
            token: fut.instrument_token,
            symbol: fut.tradingsymbol,
            name: `${fut.name} FUT`,
            exchange: 'BFO',
            segment: 'FNO',
            displaySegment: 'BSE-FUT',
            instrumentType: 'FUTURES',
            category: 'BSE',
            tradingSymbol: fut.tradingsymbol,
            lotSize: parseInt(fut.lot_size) || 10,
            tickSize: parseFloat(fut.tick_size) || 0.05,
            expiry: new Date(fut.expiry),
            isEnabled: true,
            isFeatured: true,
            sortOrder: 0
          });
          added++;
          counts['BSE-FUT']++;
        } catch (e) { errors++; }
      }
    }
    
    // 5b. BSE F&O Options
    const bseOptions = allInstruments.filter(i => {
      if (i.exchange !== 'BFO') return false;
      if (i.instrument_type !== 'CE' && i.instrument_type !== 'PE') return false;
      return bseIndexNames.some(idx => 
        i.name === idx || 
        i.tradingsymbol?.startsWith(idx) ||
        i.name?.toUpperCase() === idx
      );
    });
    
    console.log(`Found ${bseOptions.length} BFO options`);
    
    const bseOptionsByNameExpiry = {};
    for (const opt of bseOptions) {
      if (!bseOptionsByNameExpiry[opt.name]) bseOptionsByNameExpiry[opt.name] = {};
      if (!bseOptionsByNameExpiry[opt.name][opt.expiry]) bseOptionsByNameExpiry[opt.name][opt.expiry] = [];
      bseOptionsByNameExpiry[opt.name][opt.expiry].push(opt);
    }
    
    for (const [name, expiries] of Object.entries(bseOptionsByNameExpiry)) {
      const sortedExpiries = Object.keys(expiries).sort((a, b) => new Date(a) - new Date(b));
      const nearestExpiries = sortedExpiries.slice(0, 2);
      
      for (const expiry of nearestExpiries) {
        const options = expiries[expiry];
        const strikes = [...new Set(options.map(o => parseFloat(o.strike)))].sort((a, b) => a - b);
        const midIndex = Math.floor(strikes.length / 2);
        const selectedStrikes = strikes.slice(Math.max(0, midIndex - 5), midIndex + 5);
        
        for (const opt of options) {
          if (!selectedStrikes.includes(parseFloat(opt.strike))) continue;
          
          try {
            await createFromKiteDoc({
              token: opt.instrument_token,
              symbol: opt.tradingsymbol,
              name: `${opt.name} ${opt.strike} ${opt.instrument_type}`,
              exchange: 'BFO',
              segment: 'FNO',
              displaySegment: 'BSE-OPT',
              instrumentType: 'OPTIONS',
              optionType: opt.instrument_type,
              strike: parseFloat(opt.strike),
              category: 'BSE',
              tradingSymbol: opt.tradingsymbol,
              lotSize: parseInt(opt.lot_size) || 10,
              tickSize: parseFloat(opt.tick_size) || 0.05,
              expiry: new Date(opt.expiry),
              isEnabled: true,
              isFeatured: false,
              sortOrder: opt.instrument_type === 'CE' ? 10 : 20
            });
            added++;
            counts['BSE-OPT']++;
          } catch (e) { errors++; }
        }
      }
    }
    
    // Currency (CDS) sync removed - no longer part of segment structure
    
    // Subscribe to all tokens
    const allDbInstruments = await Instrument.find({ isEnabled: true }).select('token').lean();
    const tokens = allDbInstruments.map(i => parseInt(i.token)).filter(t => !isNaN(t));
    
    if (tokens.length > 0) {
      await subscribeTokens(tokens);
    }
    
    res.json({
      message: `Database reset and synced fresh from Zerodha`,
      deleted: deleteResult.deletedCount,
      counts,
      added,
      errors,
      totalInDatabase: await Instrument.countDocuments(),
      subscribedTokens: tokens.length,
      preservedAdminSnapshots: {
        byToken: preserveByToken.size,
        byExchangeSymbol: preserveByExchangeSymbol.size,
        rowsWithTradingDefaultsBeforeReset: withTradingDefaults,
      },
    });
  } catch (error) {
    console.error('Reset and sync error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Sync ALL instruments from Zerodha with proper segment categorization
router.post('/sync-all-nse', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha. Please connect first.' });
    }
    
    const apiKey = process.env.ZERODHA_API_KEY;
    
    // Download instruments CSV from Zerodha
    console.log('Downloading ALL instruments from Zerodha...');
    const response = await axios.get(
      'https://api.kite.trade/instruments',
      {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
        }
      }
    );
    
    // Parse CSV with proper quote handling
    const lines = response.data.split('\n');
    const headers = parseCSVLine(lines[0]);
    
    const allInstruments = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const values = parseCSVLine(lines[i]);
      const inst = {};
      headers.forEach((h, idx) => {
        inst[h.trim()] = values[idx]?.trim();
      });
      allInstruments.push(inst);
    }
    
    console.log(`Total instruments from Zerodha: ${allInstruments.length}`);
    
    const Instrument = (await import('../models/Instrument.js')).default;
    
    let added = 0;
    let updated = 0;
    let errors = 0;
    const counts = { 'NSE-EQ': 0, 'NSEFUT': 0, 'NSEOPT': 0, 'MCXFUT': 0, 'MCXOPT': 0, 'BSE-FUT': 0, 'BSE-OPT': 0 };
    
    // ============ 1. NSE EQUITY (Stocks) ============
    const nseEquity = allInstruments.filter(i => 
      i.exchange === 'NSE' && 
      i.segment === 'NSE' &&
      i.instrument_type === 'EQ'
    );
    
    console.log(`Found ${nseEquity.length} NSE equity instruments`);
    
    for (const stock of nseEquity) {
      try {
        const existing = await Instrument.findOne({ token: stock.instrument_token });
        const instrumentData = {
          token: stock.instrument_token,
          symbol: stock.tradingsymbol,
          name: stock.name || stock.tradingsymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          displaySegment: 'NSE-EQ',
          instrumentType: 'STOCK',
          category: 'STOCKS',
          tradingSymbol: stock.tradingsymbol,
          lotSize: parseInt(stock.lot_size) || 1,
          tickSize: parseFloat(stock.tick_size) || 0.05,
          isEnabled: true,
          isFeatured: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].includes(stock.tradingsymbol),
          sortOrder: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN'].includes(stock.tradingsymbol) ? 1 : 100
        };
        
        if (existing) {
          await Instrument.findByIdAndUpdate(existing._id, instrumentData);
          updated++;
        } else {
          await Instrument.create(instrumentData);
          added++;
        }
        counts['NSE-EQ']++;
      } catch (e) {
        errors++;
      }
    }
    
    // ============ 2. NSE INDICES ============
    const indices = allInstruments.filter(i => 
      i.exchange === 'NSE' && i.segment === 'INDICES'
    );
    
    console.log(`Found ${indices.length} NSE indices`);
    
    for (const idx of indices) {
      try {
        const existing = await Instrument.findOne({ token: idx.instrument_token });
        const isMajorIndex = ['NIFTY 50', 'NIFTY BANK', 'NIFTY FIN SERVICE', 'INDIA VIX'].includes(idx.tradingsymbol);
        const instrumentData = {
          token: idx.instrument_token,
          symbol: idx.tradingsymbol.replace(/ /g, ''),
          name: idx.tradingsymbol,
          exchange: 'NSE',
          segment: 'EQUITY',
          displaySegment: 'NSE-EQ',
          instrumentType: 'INDEX',
          category: 'INDICES',
          tradingSymbol: idx.tradingsymbol,
          lotSize: 1,
          isEnabled: true,
          isFeatured: isMajorIndex,
          sortOrder: isMajorIndex ? 0 : 50
        };
        
        if (existing) {
          await Instrument.findByIdAndUpdate(existing._id, instrumentData);
          updated++;
        } else {
          await Instrument.create(instrumentData);
          added++;
        }
        counts['NSE-EQ']++;
      } catch (e) {
        errors++;
      }
    }
    
    // ============ 3. NSE F&O (Futures & Options) ============
    const nfoFutures = allInstruments.filter(i => 
      i.exchange === 'NFO' && i.instrument_type === 'FUT'
    );
    
    // Get nearest 2 expiries for index futures
    const indexFutures = nfoFutures.filter(f => 
      ['NIFTY', 'BANKNIFTY', 'FINNIFTY'].includes(f.name)
    ).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    // Group by name and get first 2 expiries
    const futuresByName = {};
    for (const fut of indexFutures) {
      if (!futuresByName[fut.name]) futuresByName[fut.name] = [];
      if (futuresByName[fut.name].length < 2) futuresByName[fut.name].push(fut);
    }
    
    for (const [name, futures] of Object.entries(futuresByName)) {
      for (const fut of futures) {
        try {
          const existing = await Instrument.findOne({ token: fut.instrument_token });
          const instrumentData = {
            token: fut.instrument_token,
            symbol: fut.tradingsymbol,
            name: `${fut.name} FUT`,
            exchange: 'NFO',
            segment: 'FNO',
            displaySegment: 'NSEFUT',
            instrumentType: 'FUTURES',
            category: fut.name === 'NIFTY' ? 'NIFTY' : fut.name === 'BANKNIFTY' ? 'BANKNIFTY' : 'FINNIFTY',
            tradingSymbol: fut.tradingsymbol,
            lotSize: parseInt(fut.lot_size) || 25,
            tickSize: parseFloat(fut.tick_size) || 0.05,
            expiry: new Date(fut.expiry),
            isEnabled: true,
            isFeatured: true,
            sortOrder: 0
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
          counts['NSEFUT']++;
        } catch (e) {
          errors++;
        }
      }
    }
    
    // ============ 4. MCX COMMODITIES ============
    const mcxFutures = allInstruments.filter(i => 
      i.exchange === 'MCX' && i.instrument_type === 'FUT'
    );
    
    // Group by base symbol and get nearest expiry
    const mcxBySymbol = {};
    for (const fut of mcxFutures) {
      const baseSymbol = fut.name || fut.tradingsymbol.replace(/\d+[A-Z]+FUT$/, '');
      if (!mcxBySymbol[baseSymbol] || new Date(fut.expiry) < new Date(mcxBySymbol[baseSymbol].expiry)) {
        mcxBySymbol[baseSymbol] = fut;
      }
    }
    
    console.log(`Found ${Object.keys(mcxBySymbol).length} unique MCX commodities`);
    
    // Priority order for MCX
    const mcxPriority = ['GOLD', 'GOLDM', 'SILVER', 'SILVERM', 'CRUDEOIL', 'NATURALGAS', 'COPPER', 'ZINC', 'ALUMINIUM', 'LEAD', 'NICKEL'];
    
    for (const [baseSymbol, contract] of Object.entries(mcxBySymbol)) {
      try {
        const existing = await Instrument.findOne({ symbol: baseSymbol, exchange: 'MCX' });
        const priorityIndex = mcxPriority.indexOf(baseSymbol);
        const instrumentData = {
          token: contract.instrument_token,
          symbol: baseSymbol,
          name: contract.name || baseSymbol,
          exchange: 'MCX',
          segment: 'MCX',
          displaySegment: 'MCXFUT',
          instrumentType: 'FUTURES',
          category: 'MCX',
          tradingSymbol: contract.tradingsymbol,
          lotSize: parseInt(contract.lot_size) || 1,
          tickSize: parseFloat(contract.tick_size) || 1,
          expiry: new Date(contract.expiry),
          isEnabled: true,
          isFeatured: priorityIndex >= 0 && priorityIndex < 5,
          sortOrder: priorityIndex >= 0 ? priorityIndex : 100
        };
        
        if (existing) {
          await Instrument.findByIdAndUpdate(existing._id, instrumentData);
          updated++;
        } else {
          await Instrument.create(instrumentData);
          added++;
        }
        counts['MCXFUT']++;
      } catch (e) {
        errors++;
      }
    }
    
    // ============ 5. BSE F&O ============
    const bfoFutures = allInstruments.filter(i => 
      i.exchange === 'BFO' && (i.instrument_type === 'FUT' || i.instrument_type === 'CE' || i.instrument_type === 'PE')
    );
    
    // Get SENSEX and BANKEX futures
    const bseFutures = bfoFutures.filter(f => 
      f.instrument_type === 'FUT' && ['SENSEX', 'BANKEX'].includes(f.name)
    ).sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
    
    const bseFuturesByName = {};
    for (const fut of bseFutures) {
      if (!bseFuturesByName[fut.name]) bseFuturesByName[fut.name] = [];
      if (bseFuturesByName[fut.name].length < 2) bseFuturesByName[fut.name].push(fut);
    }
    
    for (const [name, futures] of Object.entries(bseFuturesByName)) {
      for (const fut of futures) {
        try {
          const existing = await Instrument.findOne({ token: fut.instrument_token });
          const instrumentData = {
            token: fut.instrument_token,
            symbol: fut.tradingsymbol,
            name: `${fut.name} FUT`,
            exchange: 'BFO',
            segment: 'FNO',
            displaySegment: 'BSE-FUT',
            instrumentType: 'FUTURES',
            category: 'BSE',
            tradingSymbol: fut.tradingsymbol,
            lotSize: parseInt(fut.lot_size) || 10,
            tickSize: parseFloat(fut.tick_size) || 0.05,
            expiry: new Date(fut.expiry),
            isEnabled: true,
            isFeatured: true,
            sortOrder: 0
          };
          
          if (existing) {
            await Instrument.findByIdAndUpdate(existing._id, instrumentData);
            updated++;
          } else {
            await Instrument.create(instrumentData);
            added++;
          }
          counts['BSE-FUT']++;
        } catch (e) {
          errors++;
        }
      }
    }
    
    // Currency (CDS) sync removed - no longer part of segment structure
    
    // Subscribe to all tokens
    const allDbInstruments = await Instrument.find({ isEnabled: true }).select('token').lean();
    const tokens = allDbInstruments.map(i => parseInt(i.token)).filter(t => !isNaN(t));
    
    console.log(`Subscribing to ${tokens.length} instruments...`);
    
    if (tokens.length > 0) {
      await subscribeTokens(tokens);
    }
    
    res.json({
      message: `Synced ALL instruments from Zerodha`,
      counts,
      added,
      updated,
      errors,
      totalInDatabase: await Instrument.countDocuments(),
      subscribedTokens: tokens.length
    });
  } catch (error) {
    console.error('Sync all NSE error:', error.response?.data || error.message);
    res.status(500).json({ message: error.response?.data?.message || error.message });
  }
});

// Subscribe to all enabled instruments
router.post('/subscribe-all', protectAdmin, async (req, res) => {
  try {
    const tickerStatus = getTickerStatus();
    if (!tickerStatus.connected) {
      return res.status(400).json({ message: 'WebSocket ticker not connected. Please connect to Zerodha first.' });
    }
    
    const Instrument = (await import('../models/Instrument.js')).default;
    const instruments = await Instrument.find({ isEnabled: true }).select('token symbol exchange').lean();
    const tokens = instruments.map(i => parseInt(i.token)).filter(t => !isNaN(t));
    
    if (tokens.length === 0) {
      return res.json({ message: 'No instruments to subscribe', subscribed: 0, total: 0 });
    }
    
    console.log(`Subscribe-all: Found ${tokens.length} enabled instruments`);
    
    // subscribeTokens is now async and batches the subscriptions
    const result = await subscribeTokens(tokens);
    
    res.json({ 
      message: `Subscribed to ${result.subscribed} instruments`, 
      subscribed: result.subscribed,
      total: result.total,
      requested: tokens.length
    });
  } catch (error) {
    console.error('Subscribe-all error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Fetch historical data for multiple instruments
router.post('/historical-bulk', protectAdmin, async (req, res) => {
  try {
    if (!zerodhaSession.accessToken) {
      return res.status(401).json({ message: 'Not logged in to Zerodha' });
    }
    
    const { tokens, interval = '15minute' } = req.body;
    const apiKey = process.env.ZERODHA_API_KEY;

    let offset = Number.parseInt(String(req.body?.offset ?? '0'), 10);
    if (!Number.isFinite(offset) || offset < 0) offset = 0;
    let limit = Number.parseInt(String(req.body?.limit ?? '40'), 10);
    if (!Number.isFinite(limit) || limit < 1) limit = 40;
    const maxBatch = 60;
    if (limit > maxBatch) limit = maxBatch;
    
    // If no tokens provided, get all enabled instruments
    let instrumentTokens = tokens;
    if (!instrumentTokens || instrumentTokens.length === 0) {
      const Instrument = (await import('../models/Instrument.js')).default;
      const instruments = await Instrument.find({ isEnabled: true }).select('token').lean();
      instrumentTokens = instruments.map(i => i.token).filter(t => t);
    }
    const total = instrumentTokens.length;
    if (offset >= total) {
      return res.json({
        message: 'No instruments in this batch (offset past end)',
        success: 0,
        errors: 0,
        data: {},
        errorDetails: [],
        total,
        offset,
        limit: 0,
        nextOffset: total,
        hasMore: false,
      });
    }

    const batch = instrumentTokens.slice(offset, offset + limit);
    const nextOffset = offset + batch.length;
    const hasMore = nextOffset < total;
    
    // Calculate date range based on interval
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    const fromDate = new Date();
    
    if (interval === 'day') {
      fromDate.setFullYear(fromDate.getFullYear() - 1);
    } else if (interval === 'minute') {
      fromDate.setDate(fromDate.getDate() - 5);
    } else if (interval === '5minute') {
      fromDate.setDate(fromDate.getDate() - 15);
    } else if (interval === '15minute') {
      fromDate.setDate(fromDate.getDate() - 30);
    } else {
      fromDate.setDate(fromDate.getDate() - 60);
    }
    const from = fromDate.toISOString().split('T')[0];
    
    console.log(
      `Historical bulk batch: offset=${offset} size=${batch.length}/${total} interval=${interval} hasMore=${hasMore}`
    );
    
    const results = {};
    const errors = [];
    
    // Fetch historical data for each token in this batch with rate limiting
    for (let i = 0; i < batch.length; i++) {
      const token = batch[i];
      
      try {
        const response = await axios.get(
          `https://api.kite.trade/instruments/historical/${token}/${interval}?from=${from}&to=${to}`,
          {
            headers: {
              'X-Kite-Version': '3',
              'Authorization': `token ${apiKey}:${zerodhaSession.accessToken}`
            }
          }
        );
        
        if (response.data.status === 'success' && response.data.data?.candles) {
          results[token] = response.data.data.candles.map(c => ({
            time: Math.floor(new Date(c[0]).getTime() / 1000),
            open: c[1],
            high: c[2],
            low: c[3],
            close: c[4],
            volume: c[5]
          }));
        }
        
        // Rate limiting: Zerodha allows ~3 requests per second
        if (i < batch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
        
        if ((i + 1) % 10 === 0) {
          console.log(`Historical data batch progress: ${i + 1}/${batch.length} (batch offset ${offset})`);
        }
      } catch (error) {
        errors.push({ token, error: error.response?.data?.message || error.message });
      }
    }
    
    console.log(
      `Historical batch done: ${Object.keys(results).length} ok, ${errors.length} err; nextOffset=${nextOffset} hasMore=${hasMore}`
    );
    
    res.json({
      message: `Fetched historical data for ${Object.keys(results).length} instruments (batch ${offset + 1}-${nextOffset} of ${total})`,
      success: Object.keys(results).length,
      errors: errors.length,
      data: results,
      errorDetails: errors.slice(0, 10),
      total,
      offset,
      limit: batch.length,
      nextOffset,
      hasMore,
    });
  } catch (error) {
    console.error('Historical bulk error:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get all subscribed tokens status
router.get('/subscription-status', protectAdmin, async (req, res) => {
  try {
    const status = getTickerStatus();
    const Instrument = (await import('../models/Instrument.js')).default;
    const totalEnabled = await Instrument.countDocuments({ isEnabled: true });
    
    res.json({
      connected: status.connected,
      subscribedTokens: status.subscribedTokens,
      totalEnabledInstruments: totalEnabled,
      allSubscribed: status.subscribedTokens >= totalEnabled
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
