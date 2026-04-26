import express from 'express';

import { protectAdmin, superAdminOnly } from '../middleware/auth.js';
import GameSettings from '../models/GameSettings.js';
import BtcJackpotBid from '../models/BtcJackpotBid.js';
import BtcJackpotResult from '../models/BtcJackpotResult.js';
import BtcJackpotBank from '../models/BtcJackpotBank.js';

import { btcJackpotDayFilter } from '../utils/btcJackpotDay.js';
import { getLiveBtcSpotForJackpot } from '../utils/btcJackpotSpot.js';
import { absDist } from '../utils/btcJackpotRanking.js';
import {
  declareBtcJackpotForDate,
  BtcJackpotDeclareError,
} from '../services/btcJackpotDeclareService.js';
import { getTodayISTString } from '../utils/istDate.js';

const router = express.Router();

/* ----------------------------- helpers ----------------------------- */

function assertDate(date) {
  const d = String(date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const err = new Error('date must be YYYY-MM-DD');
    err.statusCode = 400;
    throw err;
  }
  return d;
}

/* ----------------------------- routes ----------------------------- */

/**
 * GET /api/admin/btc-jackpot/bids?date=YYYY-MM-DD
 * All bids for a given IST day with user details.
 */
router.get('/bids', protectAdmin, async (req, res) => {
  try {
    const date = assertDate(req.query.date || getTodayISTString());
    const [bids, resultRow] = await Promise.all([
      BtcJackpotBid.find({ $and: [btcJackpotDayFilter(date)] })
        .populate('user', 'username clientId email phone')
        .lean(),
      BtcJackpotResult.findOne({ resultDate: date }).lean(),
    ]);

    let referenceBtc =
      resultRow?.lockedBtcPrice != null && Number.isFinite(Number(resultRow.lockedBtcPrice))
        ? Number(resultRow.lockedBtcPrice)
        : null;
    if (referenceBtc == null) {
      try {
        const spot = await getLiveBtcSpotForJackpot();
        if (spot?.price != null && Number.isFinite(Number(spot.price))) referenceBtc = Number(spot.price);
      } catch (_) {
        referenceBtc = null;
      }
    }

    const enriched = bids.map((b) => ({
      ...b,
      distance:
        referenceBtc != null && Number.isFinite(Number(b.predictedBtc))
          ? absDist(b.predictedBtc, referenceBtc)
          : null,
    }));

    enriched.sort((a, b) => {
      const ra = a.rank;
      const rb = b.rank;
      const aHas = ra != null && Number.isFinite(Number(ra));
      const bHas = rb != null && Number.isFinite(Number(rb));
      if (aHas && bHas) {
        if (Number(ra) !== Number(rb)) return Number(ra) - Number(rb);
      } else if (aHas && !bHas) return -1;
      else if (!aHas && bHas) return 1;
      const da = a.distance != null && Number.isFinite(a.distance) ? a.distance : Infinity;
      const db = b.distance != null && Number.isFinite(b.distance) ? b.distance : Infinity;
      if (da !== db) return da - db;
      return (+new Date(a.createdAt || 0)) - (+new Date(b.createdAt || 0));
    });

    res.json({ date, count: enriched.length, bids: enriched, referenceBtc });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * GET /api/admin/btc-jackpot/bank/:date
 */
router.get('/bank/:date', protectAdmin, async (req, res) => {
  try {
    const date = assertDate(req.params.date);
    const [bank, result] = await Promise.all([
      BtcJackpotBank.findOne({ betDate: date }).lean(),
      BtcJackpotResult.findOne({ resultDate: date }).lean(),
    ]);
    res.json({ date, bank: bank || null, result: result || null });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * POST /api/admin/btc-jackpot/lock-price
 * Body: { date, price? }
 * Super-admin only. If `price` omitted, auto-fetches Binance spot.
 * Rejects if already declared.
 */
router.post('/lock-price', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const date = assertDate(req.body?.date);
    let price = req.body?.price != null ? Number(req.body.price) : null;
    let source = 'manual';

    const existing = await BtcJackpotResult.findOne({ resultDate: date });
    if (existing?.resultDeclared) {
      return res.status(409).json({ message: 'Result already declared — cannot relock' });
    }

    if (price == null || !Number.isFinite(price) || price <= 0) {
      const spot = await getLiveBtcSpotForJackpot();
      if (!spot.price) {
        return res.status(503).json({ message: 'Binance spot unavailable; supply price manually' });
      }
      price = spot.price;
      source = spot.source || 'binance_rest';
    }

    const row = await BtcJackpotResult.findOneAndUpdate(
      { resultDate: date },
      {
        $set: {
          lockedBtcPrice: Number(price),
          lockedAt: new Date(),
          lockedBy: req.admin?._id || null,
          lockedSource: source,
        },
        $setOnInsert: { resultDate: date },
      },
      { upsert: true, new: true }
    );

    await BtcJackpotBank.findOneAndUpdate(
      { betDate: date },
      { $setOnInsert: { betDate: date }, $set: { lockedBtcPrice: Number(price), lockedAt: new Date() } },
      { upsert: true, new: true }
    );

    res.json({ message: 'BTC price locked', date, lockedBtcPrice: row.lockedBtcPrice, source });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * GET /api/admin/btc-jackpot/locked-price?date=YYYY-MM-DD
 */
router.get('/locked-price', protectAdmin, async (req, res) => {
  try {
    const date = assertDate(req.query.date || getTodayISTString());
    const row = await BtcJackpotResult.findOne({ resultDate: date }).lean();
    res.json({
      date,
      lockedBtcPrice: row?.lockedBtcPrice ?? null,
      lockedAt: row?.lockedAt ?? null,
      lockedSource: row?.lockedSource ?? null,
      resultDeclared: !!row?.resultDeclared,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * POST /api/admin/btc-jackpot/declare
 * Body: { date }
 * Super-admin only. Fails 409 if already declared.
 */
router.post('/declare', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const date = assertDate(req.body?.date);
    const out = await declareBtcJackpotForDate(date);
    res.json({ message: 'BTC Jackpot declared', ...out });
  } catch (err) {
    if (err instanceof BtcJackpotDeclareError) {
      return res.status(err.statusCode || 400).json({ message: err.message });
    }
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * PATCH /api/admin/btc-jackpot/settings
 * Super-admin only. Updates the GameSettings.games.btcJackpot slice.
 */
router.patch('/settings', protectAdmin, superAdminOnly, async (req, res) => {
  try {
    const settings = await GameSettings.getSettings();
    // Spread Mongoose subdocs misses plain fields like ticketPrice; merge from POJO snapshot.
    const plainGames = settings.toObject().games || {};
    const current =
      plainGames.btcJackpot && typeof plainGames.btcJackpot === 'object'
        ? { ...plainGames.btcJackpot }
        : {};

    const body = req.body || {};
    const allowedKeys = [
      'enabled',
      'name',
      'description',
      'ticketPrice',
      'minTickets',
      'maxTicketsPerRequest',
      'bidsPerDay',
      'topWinners',
      'biddingStartTime',
      'biddingEndTime',
      'prizePercentages',
      'hierarchy',
      'referralDistribution',
    ];

    const next = { ...current };
    for (const k of allowedKeys) {
      if (body[k] !== undefined) next[k] = body[k];
    }

    if (next.ticketPrice != null) {
      const tp = Number(next.ticketPrice);
      if (!Number.isFinite(tp) || tp <= 0) {
        return res.status(400).json({ message: 'ticketPrice must be a positive number' });
      }
      next.ticketPrice = tp;
    }

    // Basic shape guards
    if (next.prizePercentages && !Array.isArray(next.prizePercentages)) {
      return res.status(400).json({ message: 'prizePercentages must be an array' });
    }
    if (next.hierarchy && typeof next.hierarchy !== 'object') {
      return res.status(400).json({ message: 'hierarchy must be an object' });
    }

    settings.games = settings.games || {};
    settings.games.btcJackpot = next;
    settings.markModified('games');
    await settings.save();

    const out = settings.toObject().games?.btcJackpot || next;
    res.json({ message: 'BTC Jackpot settings updated', btcJackpot: out });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

/**
 * GET /api/admin/btc-jackpot/settings
 */
router.get('/settings', protectAdmin, async (req, res) => {
  try {
    const settings = await GameSettings.getSettings();
    const bj = settings.toObject().games?.btcJackpot ?? null;
    res.json({ btcJackpot: bj });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
});

export default router;
