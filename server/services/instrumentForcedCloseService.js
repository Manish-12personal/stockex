import mongoose from 'mongoose';
import Instrument from '../models/Instrument.js';
import Trade from '../models/Trade.js';
import TradingService from './tradingService.js';

/**
 * Cancel PENDING limit orders for instruments identified by token, pair, or symbol+exchange.
 */
async function cancelWorkingOrdersForInstruments(instruments) {
  let cancelled = 0;
  const errors = [];
  const or = [];
  for (const inst of instruments) {
    if (inst.token) or.push({ token: String(inst.token) });
    if (inst.pair) or.push({ pair: String(inst.pair).trim() });
    if (inst.symbol && inst.exchange) {
      or.push({ symbol: String(inst.symbol).trim(), exchange: String(inst.exchange).trim().toUpperCase() });
    }
  }
  if (or.length === 0) return { cancelled, errors };

  const pending = await Trade.find({
    status: 'PENDING',
    $or: or
  })
    .select('_id user')
    .lean();

  for (const t of pending) {
    try {
      await TradingService.cancelOrder(t._id, t.user);
      cancelled++;
    } catch (e) {
      errors.push({ tradeId: t._id, message: e?.message || String(e) });
    }
  }
  return { cancelled, errors };
}

/**
 * Square off all OPEN positions matching instrument tokens / pairs / symbol+exchange.
 */
async function squareOffOpenForInstruments(instruments) {
  let squaredOff = 0;
  const errors = [];

  for (const inst of instruments) {
    const token = inst.token != null ? String(inst.token) : '';
    const pair = inst.pair != null ? String(inst.pair).trim() : '';
    const symbol = inst.symbol != null ? String(inst.symbol).trim() : '';
    const exchange = inst.exchange != null ? String(inst.exchange).trim().toUpperCase() : '';

    const or = [];
    if (token) or.push({ token });
    if (pair) or.push({ pair });
    if (symbol && exchange) {
      or.push({ symbol, exchange });
    }
    if (or.length === 0) continue;

    const openTrades = await Trade.find({
      status: 'OPEN',
      $or: or
    }).select('_id currentPrice entryPrice');

    for (const t of openTrades) {
      try {
        const exit = t.currentPrice || t.entryPrice;
        await TradingService.squareOffPosition(t._id, 'ADMIN', exit, null, null);
        squaredOff++;
      } catch (e) {
        errors.push({ tradeId: t._id, message: e?.message || String(e) });
      }
    }
  }

  return { squaredOff, errors };
}

/**
 * Super Admin: disable instruments (with lock), square off open positions, cancel pending orders.
 */
export async function forcedCloseInstrumentsByIds(rawIds) {
  const ids = (rawIds || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (ids.length === 0) {
    return { modified: 0, squaredOff: 0, cancelled: 0, errors: [] };
  }

  const instruments = await Instrument.find({ _id: { $in: ids } }).lean();
  if (instruments.length === 0) {
    return { modified: 0, squaredOff: 0, cancelled: 0, errors: [] };
  }

  const upd = await Instrument.updateMany(
    { _id: { $in: instruments.map((i) => i._id) } },
    {
      $set: {
        isEnabled: false,
        adminLockedClosed: true,
        clientTemporaryOpenUntil: null,
        adminScheduledReopenAt: null
      }
    }
  );

  const cancelRes = await cancelWorkingOrdersForInstruments(instruments);
  const sqRes = await squareOffOpenForInstruments(instruments);

  return {
    modified: upd.modifiedCount ?? 0,
    matched: instruments.length,
    squaredOff: sqRes.squaredOff,
    cancelled: cancelRes.cancelled,
    errors: [...sqRes.errors, ...cancelRes.errors].slice(0, 50)
  };
}

/**
 * Super Admin: re-enable instruments (clears admin lock and client temp window).
 */
export async function forcedOpenInstrumentsByIds(rawIds) {
  const ids = (rawIds || [])
    .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
    .map((id) => new mongoose.Types.ObjectId(String(id)));
  if (ids.length === 0) {
    return { modified: 0 };
  }
  const upd = await Instrument.updateMany(
    { _id: { $in: ids } },
    {
      $set: {
        isEnabled: true,
        adminLockedClosed: false,
        clientTemporaryOpenUntil: null,
        adminScheduledReopenAt: null
      }
    }
  );
  return { modified: upd.modifiedCount ?? 0 };
}
