/**
 * EOD: margin-aware closes at LTP (oldest BUY first), then StopOutService flattens remaining MIS.
 */

import Trade from '../models/Trade.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import TradingService from './tradingService.js';
import WalletService from './walletService.js';
import { calculatePortfolioReduction } from './autoSquareOffEngine.js';
import { getLTPMapForTrades, cacheKeyForTrade } from './ltpResolutionService.js';

export function segmentQueryForEod(segment) {
  if (segment === 'MCX') {
    return {
      $or: [
        { exchange: 'MCX' },
        { segment: 'MCX' },
        { segment: 'MCXFUT' },
        { segment: 'MCXOPT' },
      ],
    };
  }
  return {
    exchange: { $in: ['NSE', 'BSE', 'NFO'] },
    segment: { $nin: ['CRYPTO', 'MCX', 'MCXFUT', 'MCXOPT'] },
  };
}

function tradesToEnginePositions(trades, ltpMap) {
  const rows = [];
  for (const t of trades) {
    if (String(t.status) !== 'OPEN') continue;
    if (String(t.side) !== 'BUY') continue;
    const ck = cacheKeyForTrade(t);
    const ltp = ltpMap.get(ck);
    if (!(ltp > 0)) continue;
    rows.push({
      id: t._id.toString(),
      symbol: t.symbol,
      quantity: Number(t.quantity) || 0,
      price: ltp,
      type: t.productType === 'MIS' || t.productType === 'INTRADAY' ? 'INTRADAY' : 'CARRY',
      createdAt: t.createdAt || t.openedAt,
    });
  }
  return rows;
}

function markPricesFromMap(trades, ltpMap) {
  const bySym = {};
  for (const t of trades) {
    const sym = t.symbol;
    if (!sym) continue;
    const ck = cacheKeyForTrade(t);
    const p = ltpMap.get(ck);
    if (p > 0) bySym[sym] = p;
  }
  return bySym;
}

async function leverageForUser(user) {
  const admin = await Admin.findOne({ adminCode: user.adminCode }).select('charges').lean();
  const intra = Math.max(1, Number(admin?.charges?.intradayLeverage) || 5);
  const carry = Math.max(1, Number(admin?.charges?.deliveryLeverage) || 1);
  return { intradayMultiplier: intra, carryMultiplier: carry };
}

function walletBalanceAndM2M(user) {
  const w = user.wallet || {};
  const cash = Number(w.cashBalance ?? w.tradingBalance ?? w.balance) || 0;
  const m2m = Number(w.unrealizedPnL) || 0;
  return { walletBalance: cash, m2mPnL: m2m };
}

/**
 * Margin shortfall pass: close oldest BUY MIS (MARKET-style exit at LTP) until plan clears.
 */
export async function runMarginAwareCloses(segment = 'NSE') {
  const segmentQuery = segmentQueryForEod(segment);
  const initial = await Trade.find({
    status: 'OPEN',
    productType: { $in: ['MIS', 'INTRADAY'] },
    ...segmentQuery,
  })
    .populate('user')
    .lean();

  if (initial.length === 0) {
    return { marginPasses: 0, closedTrades: 0, usersProcessed: 0 };
  }

  const userIds = [...new Set(initial.map((p) => p.user?._id?.toString()).filter(Boolean))];

  let closedTrades = 0;
  let marginPasses = 0;

  for (const userId of userIds) {
    const maxIter = 80;
    for (let iter = 0; iter < maxIter; iter++) {
      const openList = await Trade.find({
        user: userId,
        status: 'OPEN',
        productType: { $in: ['MIS', 'INTRADAY'] },
        ...segmentQuery,
      }).lean();

      const longs = openList.filter((t) => String(t.side) === 'BUY');
      if (longs.length === 0) break;

      const ltMap = await getLTPMapForTrades(openList);
      const user = await User.findById(userId);
      if (!user) break;

      const { walletBalance, m2mPnL } = walletBalanceAndM2M(user);
      const leverage = await leverageForUser(user);
      const engineRows = tradesToEnginePositions(openList, ltMap);
      if (engineRows.length === 0) break;

      const markPricesBySymbol = markPricesFromMap(openList, ltMap);
      const plan = calculatePortfolioReduction({
        walletBalance,
        m2mPnL,
        positions: engineRows,
        leverage,
        markPricesBySymbol,
      });

      if (!plan.shouldSquareOff) break;
      marginPasses += 1;

      const candidates = [...plan.perSymbol].filter((r) => r.reductionQty > 1e-9);
      candidates.sort((a, b) => b.reductionQty - a.reductionQty);
      const pick = candidates[0];
      if (!pick?.symbol) break;

      const symTrades = longs
        .filter((t) => t.symbol === pick.symbol)
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

      const victim = symTrades[0];
      if (!victim?._id) break;

      const ck = cacheKeyForTrade(victim);
      const ltp = ltMap.get(ck) || pick.markPrice;
      if (!(ltp > 0)) break;

      try {
        await TradingService.squareOffPosition(
          victim._id.toString(),
          'TIME_BASED',
          ltp,
          null,
          null
        );
        closedTrades += 1;
      } catch (e) {
        console.error('[runMarginAwareCloses] squareOff failed:', userId, victim.symbol, e?.message || e);
        break;
      }

      await WalletService.recalculateWallet(userId);
    }
  }

  return { marginPasses, closedTrades, usersProcessed: userIds.length };
}

export default { runMarginAwareCloses, segmentQueryForEod };
