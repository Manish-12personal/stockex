import express from 'express';
import axios from 'axios';

const router = express.Router();

// Binance API base URL
const BINANCE_API = 'https://api.binance.com/api/v3';
const BINANCE_API_KEY = process.env.BINANCE_API_KEY || '';

// Authenticated axios instance for higher rate limits
const binanceAxios = axios.create({
  baseURL: BINANCE_API,
  headers: BINANCE_API_KEY ? { 'X-MBX-APIKEY': BINANCE_API_KEY } : {}
});

/** Global api.binance.com spot klines do not support *INR; map display pairs to USDT. */
function resolveBinanceSpotKlineSymbol(raw) {
  const u = String(raw || '').toUpperCase().trim();
  if (!u) return '';
  if (u.endsWith('INR') && u.length > 3) return `${u.slice(0, -3)}USDT`;
  if (u.endsWith('USDT') || u.endsWith('BUSD') || u.endsWith('FDUSD')) return u;
  return `${u}USDT`;
}

// Popular crypto symbols to track
const CRYPTO_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT',
  'DOGEUSDT', 'SOLUSDT', 'DOTUSDT', 'MATICUSDT', 'LTCUSDT',
  'AVAXUSDT', 'LINKUSDT', 'ATOMUSDT', 'UNIUSDT', 'XLMUSDT'
];

// Get real-time prices for all crypto
router.get('/prices', async (req, res) => {
  try {
    // Fetch 24hr ticker for all symbols
    const response = await binanceAxios.get('/ticker/24hr', {
      params: {
        symbols: JSON.stringify(CRYPTO_SYMBOLS)
      }
    });

    const cryptoData = {};
    response.data.forEach(ticker => {
      const symbol = ticker.symbol.replace('USDT', '');
      cryptoData[ticker.symbol] = {
        symbol: symbol,
        pair: ticker.symbol,
        exchange: 'BINANCE',
        ltp: parseFloat(ticker.lastPrice),
        open: parseFloat(ticker.openPrice),
        high: parseFloat(ticker.highPrice),
        low: parseFloat(ticker.lowPrice),
        close: parseFloat(ticker.prevClosePrice),
        change: parseFloat(ticker.priceChange),
        changePercent: parseFloat(ticker.priceChangePercent).toFixed(2),
        volume: parseFloat(ticker.volume),
        quoteVolume: parseFloat(ticker.quoteVolume),
        lastUpdated: new Date()
      };
    });

    res.json(cryptoData);
  } catch (error) {
    console.error('Binance price fetch error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Get single crypto price
router.get('/price/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const pair = resolveBinanceSpotKlineSymbol(symbol);

    const response = await binanceAxios.get('/ticker/24hr', {
      params: { symbol: pair }
    });

    const ticker = response.data;
    res.json({
      symbol: ticker.symbol.replace('USDT', ''),
      pair: ticker.symbol,
      exchange: 'BINANCE',
      ltp: parseFloat(ticker.lastPrice),
      open: parseFloat(ticker.openPrice),
      high: parseFloat(ticker.highPrice),
      low: parseFloat(ticker.lowPrice),
      close: parseFloat(ticker.prevClosePrice),
      change: parseFloat(ticker.priceChange),
      changePercent: parseFloat(ticker.priceChangePercent).toFixed(2),
      volume: parseFloat(ticker.volume),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error('Binance single price error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Get candle/kline data for charts
router.get('/candles/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { interval = '15m', limit = 500 } = req.query;

    const pair = resolveBinanceSpotKlineSymbol(symbol);

    // Binance intervals: 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
    const response = await binanceAxios.get('/klines', {
      params: {
        symbol: pair,
        interval: interval,
        limit: limit
      }
    });

    // Transform to lightweight-charts format
    const candles = response.data.map(k => ({
      time: Math.floor(k[0] / 1000), // Convert ms to seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5])
    }));

    res.json(candles);
  } catch (error) {
    console.error('Binance candle fetch error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Get order book depth
router.get('/depth/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { limit = 20 } = req.query;

    const pair = resolveBinanceSpotKlineSymbol(symbol);

    const response = await binanceAxios.get('/depth', {
      params: {
        symbol: pair,
        limit: limit
      }
    });

    res.json({
      bids: response.data.bids.map(b => ({ price: parseFloat(b[0]), qty: parseFloat(b[1]) })),
      asks: response.data.asks.map(a => ({ price: parseFloat(a[0]), qty: parseFloat(a[1]) }))
    });
  } catch (error) {
    console.error('Binance depth error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// Search for crypto symbols
router.get('/search', async (req, res) => {
  try {
    const { query } = req.query;
    
    // Get exchange info for all symbols
    const response = await binanceAxios.get('/exchangeInfo');
    
    const usdtPairs = response.data.symbols
      .filter(s => s.quoteAsset === 'USDT' && s.status === 'TRADING')
      .filter(s => s.baseAsset.toLowerCase().includes(query?.toLowerCase() || ''))
      .slice(0, 20)
      .map(s => ({
        symbol: s.baseAsset,
        pair: s.symbol,
        exchange: 'BINANCE'
      }));

    res.json(usdtPairs);
  } catch (error) {
    console.error('Binance search error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

export default router;
