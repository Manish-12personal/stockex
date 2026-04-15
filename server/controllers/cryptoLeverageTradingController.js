import CryptoLeverageUser from '../models/CryptoLeverageUser.js';
import CryptoLeveragePosition from '../models/CryptoLeveragePosition.js';
import cryptoLeverageTradingService, {
  computeCarryForwardLimit,
  computeIntradayLimit,
} from '../services/cryptoLeverageTradingService.js';

/**
 * Resolve `CryptoLeverageUser` for the authenticated platform user.
 */
async function getOrCreateLeverageAccount(req) {
  const fromClient =
    req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' ? req.body || {} : {};
  const defaults = {
    walletBalance: Number(fromClient.walletBalance ?? 0) || 0,
    intradayLeverage: Number(fromClient.intradayLeverage ?? 10) || 10,
    carryForwardLeverage: Number(fromClient.carryForwardLeverage ?? 2) || 2,
  };
  return cryptoLeverageTradingService.ensureAccountForMainUser(req.user._id, defaults);
}

function handleError(res, err, fallbackStatus = 500) {
  const status = err.statusCode || fallbackStatus;
  const payload = {
    message: err.message || 'Unexpected error',
  };
  if (process.env.NODE_ENV !== 'production' && err.stack) {
    payload.stack = err.stack;
  }
  return res.status(status).json(payload);
}

/**
 * GET /api/crypto-leverage/account/me
 * Ensures a linked crypto leverage account exists and returns it (without sensitive noise).
 */
export async function getMyAccount(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    return res.json({
      id: acc._id,
      walletBalance: acc.walletBalance,
      intradayLeverage: acc.intradayLeverage,
      carryForwardLeverage: acc.carryForwardLeverage,
      intradayLimit: computeIntradayLimit(acc),
      carryForwardLimit: computeCarryForwardLimit(acc),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /api/crypto-leverage/account/me/configure
 * body: { walletBalance?, intradayLeverage?, carryForwardLeverage? }
 * Updates the linked crypto account (for admin/demo setups — tighten with roles in production).
 */
export async function configureMyAccount(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const { walletBalance, intradayLeverage, carryForwardLeverage } = req.body || {};
    const updates = {};
    if (walletBalance != null) {
      const w = Number(walletBalance);
      if (!Number.isFinite(w) || w < 0) {
        return res.status(400).json({ message: 'walletBalance must be a non-negative number' });
      }
      updates.walletBalance = w;
    }
    if (intradayLeverage != null) {
      const x = Number(intradayLeverage);
      if (!Number.isFinite(x) || x < 1) {
        return res.status(400).json({ message: 'intradayLeverage must be >= 1' });
      }
      updates.intradayLeverage = x;
    }
    if (carryForwardLeverage != null) {
      const y = Number(carryForwardLeverage);
      if (!Number.isFinite(y) || y < 1) {
        return res.status(400).json({ message: 'carryForwardLeverage must be >= 1' });
      }
      updates.carryForwardLeverage = y;
    }
    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    const next = await CryptoLeverageUser.findByIdAndUpdate(acc._id, { $set: updates }, { new: true });
    return res.json({
      id: next._id,
      walletBalance: next.walletBalance,
      intradayLeverage: next.intradayLeverage,
      carryForwardLeverage: next.carryForwardLeverage,
      intradayLimit: computeIntradayLimit(next),
      carryForwardLimit: computeCarryForwardLimit(next),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /api/crypto-leverage/limits/me
 */
export async function getMyLimits(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    return res.json({
      walletBalance: acc.walletBalance,
      intradayLeverage: acc.intradayLeverage,
      carryForwardLeverage: acc.carryForwardLeverage,
      intradayLimit: computeIntradayLimit(acc),
      carryForwardLimit: computeCarryForwardLimit(acc),
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /api/crypto-leverage/positions/open
 * body: { symbol, side, quantity, entryPrice }
 */
export async function openMyPosition(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const { symbol, side, quantity, entryPrice } = req.body || {};
    const result = await cryptoLeverageTradingService.openPosition({
      userId: acc._id,
      symbol,
      side,
      quantity,
      entryPrice,
    });
    return res.status(201).json(result);
  } catch (err) {
    return handleError(res, err, 400);
  }
}

/**
 * POST /api/crypto-leverage/market-close/me
 * body: { ltp }
 * Runs portfolio EOD trim vs carry-forward notional cap.
 */
export async function runMyMarketClose(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const { ltp } = req.body || {};
    const out = await cryptoLeverageTradingService.processMarketCloseForUser(acc._id, ltp);
    return res.json(out);
  } catch (err) {
    return handleError(res, err, 400);
  }
}

/**
 * POST /api/crypto-leverage/square-off/me
 * body: { positionId, ltp }
 * Uses `executeSquareOff` for a single position (spec behaviour).
 */
export async function squareOffMyPosition(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const { positionId, ltp } = req.body || {};
    if (!positionId) {
      return res.status(400).json({ message: 'positionId is required' });
    }
    const user = await CryptoLeverageUser.findById(acc._id);
    const position = await CryptoLeveragePosition.findById(positionId);
    if (!position) {
      return res.status(404).json({ message: 'Position not found' });
    }
    const out = await cryptoLeverageTradingService.executeSquareOff(user, position, ltp, {
      reason: 'MANUAL',
    });
    return res.json(out);
  } catch (err) {
    return handleError(res, err, 400);
  }
}

/**
 * POST /api/crypto-leverage/risk/check/me
 * body: { ltp }
 */
export async function checkMyMarginRisk(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const { ltp } = req.body || {};
    const out = await cryptoLeverageTradingService.enforceMarginRisk(acc._id, ltp);
    return res.json(out);
  } catch (err) {
    return handleError(res, err, 400);
  }
}

/**
 * GET /api/crypto-leverage/transactions/me?limit=50
 */
export async function listMyTransactions(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const rows = await cryptoLeverageTradingService.listTransactions(acc._id, {
      limit: req.query?.limit,
    });
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /api/crypto-leverage/positions/me
 */
export async function listMyPositions(req, res) {
  try {
    const acc = await getOrCreateLeverageAccount(req);
    const rows = await CryptoLeveragePosition.find({ user: acc._id }).sort({ updatedAt: -1 }).lean();
    return res.json(rows);
  } catch (err) {
    return handleError(res, err);
  }
}
