import mongoose from 'mongoose';
import CryptoLeverageUser from '../models/CryptoLeverageUser.js';
import CryptoLeveragePosition from '../models/CryptoLeveragePosition.js';
import CryptoLeverageTransaction from '../models/CryptoLeverageTransaction.js';

const EPS = 1e-12;

function roundQty(q, decimals = 8) {
  if (!Number.isFinite(q)) return 0;
  const p = 10 ** decimals;
  return Math.round(q * p) / p;
}

function assertPositiveNumber(name, value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) {
    const err = new Error(`${name} must be a finite number > 0`);
    err.statusCode = 400;
    throw err;
  }
  return n;
}

/**
 * @param {import('../models/CryptoLeverageUser.js').default} userDoc
 */
export function computeIntradayLimit(userDoc) {
  return userDoc.walletBalance * userDoc.intradayLeverage;
}

/**
 * @param {import('../models/CryptoLeverageUser.js').default} userDoc
 */
export function computeCarryForwardLimit(userDoc) {
  return userDoc.walletBalance * userDoc.carryForwardLeverage;
}

/**
 * Sum of OPEN position notionals at `ltp`.
 * @param {import('mongoose').ClientSession} [session]
 */
export async function sumOpenNotional(userId, ltp, session = null) {
  const q = CryptoLeveragePosition.find({ user: userId, status: 'OPEN' });
  if (session) q.session(session);
  const positions = await q;
  let total = 0;
  for (const p of positions) {
    total += p.notionalAt(ltp);
  }
  return total;
}

/**
 * Required margin pool: total notional / intraday leverage (simplified crypto-style).
 */
export function requiredMarginForNotional(userDoc, openNotionalAtLtp) {
  const lev = userDoc.intradayLeverage;
  if (!Number.isFinite(lev) || lev <= 0) return Infinity;
  return openNotionalAtLtp / lev;
}

function resolveTxType(reason, fullyClosed) {
  if (reason === 'MARGIN_LIQUIDATION') return 'LIQUIDATION';
  if (reason === 'MANUAL') return fullyClosed ? 'FULL_CLOSE' : 'PARTIAL_CLOSE';
  if (reason === 'EOD_SQUARE_OFF') return fullyClosed ? 'FULL_CLOSE' : 'EOD_SQUARE_OFF';
  return fullyClosed ? 'FULL_CLOSE' : 'PARTIAL_CLOSE';
}

class CryptoLeverageTradingService {
  /**
   * Create or fetch crypto leverage account linked to main User.
   */
  async ensureAccountForMainUser(mainUserId, defaults = {}) {
    let acc = await CryptoLeverageUser.findOne({ mainUser: mainUserId });
    if (acc) return acc;
    acc = await CryptoLeverageUser.create({
      mainUser: mainUserId,
      walletBalance: defaults.walletBalance ?? 0,
      intradayLeverage: defaults.intradayLeverage ?? 10,
      carryForwardLeverage: defaults.carryForwardLeverage ?? 2,
    });
    return acc;
  }

  async getAccountById(id) {
    const acc = await CryptoLeverageUser.findById(id);
    if (!acc) {
      const err = new Error('Crypto leverage user not found');
      err.statusCode = 404;
      throw err;
    }
    return acc;
  }

  /**
   * Open a new position if cumulative notional (at entry price) ≤ intraday limit.
   */
  async openPosition({ userId, symbol, side, quantity, entryPrice }) {
    const qty = assertPositiveNumber('quantity', quantity);
    const price = assertPositiveNumber('entryPrice', entryPrice);
    const sym = String(symbol || '').trim().toUpperCase();
    if (!sym) {
      const err = new Error('symbol is required');
      err.statusCode = 400;
      throw err;
    }
    if (!['LONG', 'SHORT'].includes(side)) {
      const err = new Error('side must be LONG or SHORT');
      err.statusCode = 400;
      throw err;
    }

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const user = await CryptoLeverageUser.findById(userId).session(session);
      if (!user) {
        const err = new Error('Crypto leverage user not found');
        err.statusCode = 404;
        throw err;
      }

      const newNotional = qty * price;
      const existing = await sumOpenNotional(userId, price, session);
      const intradayLimit = computeIntradayLimit(user);

      if (existing + newNotional > intradayLimit + EPS) {
        const err = new Error(
          `Intraday limit exceeded. limit=${intradayLimit.toFixed(8)} existing=${existing.toFixed(8)} new=${newNotional.toFixed(8)}`
        );
        err.statusCode = 400;
        throw err;
      }

      const [position] = await CryptoLeveragePosition.create(
        [
          {
            user: userId,
            symbol: sym,
            side,
            quantity: qty,
            entryPrice: price,
            status: 'OPEN',
            lastActionReason: 'NONE',
          },
        ],
        { session }
      );

      await CryptoLeverageTransaction.create(
        [
          {
            user: userId,
            position: position._id,
            type: 'OPEN',
            quantityDelta: side === 'LONG' ? qty : -qty,
            price,
            notional: newNotional,
            meta: { symbol: sym, side },
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return { position, intradayLimit, carryForwardLimit: computeCarryForwardLimit(user) };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  /**
   * Reduce exposure by closing `quantityToClose` base units at `price`.
   * @private — use executeSquareOff / risk jobs instead of calling directly.
   */
  async _closeQuantity(user, positionId, quantityToClose, price, reason) {
    const qtyClose = roundQty(assertPositiveNumber('quantityToClose', quantityToClose));
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      const fresh = await CryptoLeveragePosition.findById(positionId).session(session);
      if (!fresh || fresh.status !== 'OPEN') {
        const err = new Error('Position is not OPEN');
        err.statusCode = 400;
        throw err;
      }
      if (String(fresh.user) !== String(user._id)) {
        const err = new Error('Position does not belong to user');
        err.statusCode = 403;
        throw err;
      }

      const applied = Math.min(qtyClose, fresh.quantity);
      if (applied <= EPS) {
        await session.abortTransaction();
        return { skipped: true, reason: 'nothing_to_close' };
      }

      const notionalClosed = applied * price;
      const newQty = roundQty(fresh.quantity - applied);
      const fullyClosed = newQty <= EPS;

      fresh.quantity = fullyClosed ? 0 : newQty;
      fresh.status = fullyClosed ? 'CLOSED' : 'OPEN';
      fresh.lastActionReason = reason;
      await fresh.save({ session });

      const qtyDelta = fresh.side === 'LONG' ? -applied : applied;
      const txType = resolveTxType(reason, fullyClosed);

      await CryptoLeverageTransaction.create(
        [
          {
            user: user._id,
            position: fresh._id,
            type: txType,
            quantityDelta: qtyDelta,
            price,
            notional: notionalClosed,
            meta: { reason, appliedQty: applied },
          },
        ],
        { session }
      );

      await session.commitTransaction();
      return {
        skipped: false,
        quantityClosed: applied,
        notionalClosed,
        remainingQuantity: fresh.quantity,
        status: fresh.status,
        txType,
      };
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }
  }

  /**
   * If `positionValue` (abs qty × LTP) exceeds the user's carry-forward notional cap,
   * auto square-off the excess: `squareOffAmount = positionValue - carryForwardLimit`,
   * `quantityToSell = squareOffAmount / LTP` (capped by open qty).
   *
   * Margin pass (`reason: MARGIN_LIQUIDATION`) closes up to full position notional.
   */
  async executeSquareOff(user, position, ltp, opts = {}) {
    const reason = opts.reason || 'EOD_SQUARE_OFF';
    const price = assertPositiveNumber('ltp', ltp);

    if (String(position.status) !== 'OPEN') {
      const err = new Error('Position is not OPEN');
      err.statusCode = 400;
      throw err;
    }
    if (String(position.user) !== String(user._id)) {
      const err = new Error('Position does not belong to user');
      err.statusCode = 403;
      throw err;
    }

    const positionValue = position.notionalAt(price);
    const carryForwardLimit = computeCarryForwardLimit(user);

    let squareOffAmount = 0;
    if (reason === 'MARGIN_LIQUIDATION' || reason === 'MANUAL') {
      squareOffAmount = positionValue;
    } else if (positionValue > carryForwardLimit + EPS) {
      squareOffAmount = positionValue - carryForwardLimit;
    } else {
      return {
        skipped: true,
        reason: 'within_carry_forward_limit',
        positionValue,
        carryForwardLimit,
      };
    }

    let quantityToSell = squareOffAmount / price;
    quantityToSell = Math.min(quantityToSell, position.quantity);
    quantityToSell = roundQty(quantityToSell);

    if (quantityToSell <= EPS) {
      return {
        skipped: true,
        reason: 'quantity_to_close_too_small',
        squareOffAmount,
        positionValue,
        carryForwardLimit,
      };
    }

    const closeRes = await this._closeQuantity(user, position._id, quantityToSell, price, reason);
    return {
      ...closeRes,
      squareOffAmount,
      quantityToSell,
      ltp: price,
      carryForwardLimit,
      positionValueBefore: positionValue,
    };
  }

  /**
   * Portfolio-aware EOD: if **aggregate** open notional exceeds carry-forward cap,
   * trims positions (largest notional first) until the portfolio fits the cap.
   */
  async processMarketCloseForUser(userId, ltp) {
    const user = await this.getAccountById(userId);
    const price = assertPositiveNumber('ltp', ltp);
    const cf = computeCarryForwardLimit(user);

    let total = await sumOpenNotional(userId, price);
    if (total <= cf + EPS) {
      return { userId, ltp: price, carryForwardLimit: cf, totalOpenBefore: total, results: [] };
    }

    let excess = total - cf;
    const results = [];
    const safetyMax = 500;

    for (let i = 0; i < safetyMax && excess > EPS; i += 1) {
      const open = await CryptoLeveragePosition.find({ user: userId, status: 'OPEN' });
      if (!open.length) break;

      let pick = open[0];
      let pickNv = pick.notionalAt(price);
      for (const p of open) {
        const nv = p.notionalAt(price);
        if (nv > pickNv) {
          pick = p;
          pickNv = nv;
        }
      }

      const squareOffAmount = Math.min(excess, pickNv);
      const qty = roundQty(squareOffAmount / price);
      if (qty <= EPS) break;

      const r = await this._closeQuantity(user, pick._id, qty, price, 'EOD_SQUARE_OFF');
      results.push({ positionId: pick._id, squareOffAmount, quantityToSell: qty, ...r });

      const newTotal = await sumOpenNotional(userId, price);
      excess = newTotal - cf;
    }

    const totalAfter = await sumOpenNotional(userId, price);
    return {
      userId,
      ltp: price,
      carryForwardLimit: cf,
      totalOpenBefore: total,
      totalOpenAfter: totalAfter,
      results,
    };
  }

  /**
   * If wallet balance < required margin for open notional at LTP, liquidate OPEN positions.
   */
  async enforceMarginRisk(userId, ltp) {
    const user = await this.getAccountById(userId);
    const price = assertPositiveNumber('ltp', ltp);
    const openNotional = await sumOpenNotional(userId, price);
    const required = requiredMarginForNotional(user, openNotional);

    if (user.walletBalance + EPS >= required) {
      return {
        liquidated: false,
        walletBalance: user.walletBalance,
        openNotional,
        requiredMargin: required,
      };
    }

    const positions = await CryptoLeveragePosition.find({ user: userId, status: 'OPEN' });
    const outs = [];
    for (const pos of positions) {
      const r = await this.executeSquareOff(user, pos, price, { reason: 'MARGIN_LIQUIDATION' });
      outs.push({ positionId: pos._id, ...r });
    }

    return {
      liquidated: true,
      walletBalance: user.walletBalance,
      openNotionalBefore: openNotional,
      requiredMarginBefore: required,
      results: outs,
    };
  }

  async listTransactions(userId, { limit = 50 } = {}) {
    const lim = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return CryptoLeverageTransaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(lim)
      .lean();
  }
}

const cryptoLeverageTradingService = new CryptoLeverageTradingService();

/**
 * Named export for callers/tests: single-position square-off vs carry-forward cap (or full for margin).
 */
export async function executeSquareOff(user, position, ltp, opts) {
  return cryptoLeverageTradingService.executeSquareOff(user, position, ltp, opts);
}

export default cryptoLeverageTradingService;
