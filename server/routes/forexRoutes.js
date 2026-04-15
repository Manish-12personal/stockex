import express from 'express';
import { getForexCandles, FOREX_PAIRS } from '../services/forexMarketService.js';

const router = express.Router();

/**
 * OHLC built from in-memory poll samples (~5s) — same shape as /api/binance/candles for lightweight-charts.
 */
router.get('/candles/:pair', (req, res) => {
  try {
    const pair = String(req.params.pair || '').toUpperCase();
    if (!FOREX_PAIRS.includes(pair)) {
      return res.status(404).json({ message: 'Unknown forex pair' });
    }
    const interval = String(req.query.interval || '15m');
    const limit = Math.min(1000, Math.max(10, parseInt(String(req.query.limit), 10) || 500));
    const candles = getForexCandles(pair, interval, limit);
    res.json(candles);
  } catch (e) {
    console.error('[forexRoutes] candles:', e.message);
    res.status(500).json({ message: e.message });
  }
});

export default router;
