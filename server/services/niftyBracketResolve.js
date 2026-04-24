import User from '../models/User.js';
import GameSettings from '../models/GameSettings.js';
import { atomicGamesWalletUpdate } from '../utils/gamesWallet.js';
import { recordGamesWalletLedger } from '../utils/gamesWalletLedger.js';
import {
  distributeGameProfit,
  distributeWinBrokerage,
  computeNiftyJackpotGrossHierarchyBreakdown,
  creditNiftyJackpotGrossHierarchyFromPool,
} from './gameProfitDistribution.js';

/**
 * Resolve one active Nifty Bracket trade.
 * When trade.settlesAtSessionClose is true, win/loss is decided only at/after expiresAt
 * (result time, e.g. 3:30 PM IST), not when live price touches the band earlier.
 * `entryPrice` on the trade is the **spread line** the user bet on (upper for BUY, lower for SELL); `spotAtOrder` is the centre Nifty.
 * Session-close `directionVsEntry` compares settlement LTP to `entryPrice` (that line). `breakPastBands` uses the same outer-band test vs `upperTarget`/`lowerTarget` (equivalent for wins when those match the chosen side’s line).
 *
 * Win: user is credited full gross payout (stake × multiplier); hierarchy / brokerage is funded from
 * the Super Admin pool (same economics as other games).
 *
 * @param {import('mongoose').Document} trade
 * @param {number|string} currentPrice
 * @param {{ forceMidRangeAsExpired?: boolean, bypassSettlementTime?: boolean }} options — forceMidRangeAsExpired: allow settling when LTP is between bands (still resolves as **lost**).
 */
export async function resolveNiftyBracketTrade(trade, currentPrice, options = {}) {
  const { forceMidRangeAsExpired = false, bypassSettlementTime = false } = options;

  const price = parseFloat(currentPrice);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Invalid current price');
  }
  if (trade.status !== 'active') {
    throw new Error('Trade is not active');
  }

  const now = new Date();
  let status;
  let exitPrice;
  let profit = 0;
  let brokerageAmount = 0;

  const gsBracket = await GameSettings.getSettings();
  const gcBr = gsBracket?.games?.niftyBracket || {};
  const strictLtp = gcBr.bracketStrictLtpComparison !== false;
  const sessionCloseRule =
    gcBr.bracketSessionCloseRule === 'breakPastBands' ? 'breakPastBands' : 'directionVsEntry';

  const expiresAtMs = new Date(trade.expiresAt).getTime();
  const atOrAfterSettlement = now.getTime() >= expiresAtMs;
  const sessionClose = trade.settlesAtSessionClose === true;

  const hitUpper = strictLtp ? price > trade.upperTarget : price >= trade.upperTarget;
  const hitLower = strictLtp ? price < trade.lowerTarget : price <= trade.lowerTarget;
  const expired = atOrAfterSettlement;

  const stakeAmt = Number(trade.amount);
  const winMultSafe = Number(trade.winMultiplier) > 0 ? Number(trade.winMultiplier) : 2;

  if (sessionClose) {
    if (!atOrAfterSettlement && !forceMidRangeAsExpired && !bypassSettlementTime) {
      throw new Error('Trade is still active, no target hit yet');
    }
    const entryPx = parseFloat(trade.entryPrice);
    const hasEntry = Number.isFinite(entryPx) && entryPx > 0;

    if (sessionCloseRule === 'directionVsEntry' && hasEntry) {
      /** Result-time: compare settlement LTP to the reference (entry) — BUY wins if price finished above, SELL if below. */
      exitPrice = price;
      const upBeats = strictLtp ? price > entryPx : price >= entryPx;
      const downBeats = strictLtp ? price < entryPx : price <= entryPx;
      if (trade.prediction === 'BUY' && upBeats) {
        status = 'won';
      } else if (trade.prediction === 'SELL' && downBeats) {
        status = 'won';
      } else {
        profit = -stakeAmt;
        status = 'lost';
      }
    } else if (sessionCloseRule === 'breakPastBands' || !hasEntry) {
      if (hitUpper) {
        exitPrice = trade.upperTarget;
        if (trade.prediction === 'BUY') {
          status = 'won';
        } else {
          profit = -stakeAmt;
          status = 'lost';
        }
      } else if (hitLower) {
        exitPrice = trade.lowerTarget;
        if (trade.prediction === 'SELL') {
          status = 'won';
        } else {
          profit = -stakeAmt;
          status = 'lost';
        }
      } else {
        exitPrice = price;
        profit = -stakeAmt;
        status = 'lost';
      }
    }
  } else if (hitUpper) {
    exitPrice = trade.upperTarget;
    if (trade.prediction === 'BUY') {
      status = 'won';
    } else {
      profit = -stakeAmt;
      status = 'lost';
    }
  } else if (hitLower) {
    exitPrice = trade.lowerTarget;
    if (trade.prediction === 'SELL') {
      status = 'won';
    } else {
      profit = -stakeAmt;
      status = 'lost';
    }
  } else if (expired) {
    exitPrice = price;
    profit = -stakeAmt;
    status = 'lost';
  } else if (forceMidRangeAsExpired && !hitUpper && !hitLower) {
    exitPrice = price;
    profit = -stakeAmt;
    status = 'lost';
  } else {
    throw new Error('Trade is still active, no target hit yet');
  }

  const userIdForTrade = trade.user?._id || trade.user;

  let bracketGrossBreakdown = null;
  let bracketUseHierarchy = false;
  let bracketUserDoc = null;

  if (status === 'won') {
    bracketUserDoc = await User.findById(userIdForTrade).populate('admin');
    const grossWin = stakeAmt * winMultSafe;
    const grossHierarchyPctSum =
      (Number(gcBr?.grossPrizeSubBrokerPercent) || 0) +
      (Number(gcBr?.grossPrizeBrokerPercent) || 0) +
      (Number(gcBr?.grossPrizeAdminPercent) || 0);
    if (grossHierarchyPctSum > 0 && bracketUserDoc) {
      bracketGrossBreakdown = await computeNiftyJackpotGrossHierarchyBreakdown(
        bracketUserDoc,
        grossWin,
        gcBr
      );
      brokerageAmount = bracketGrossBreakdown.totalHierarchy;
      if (brokerageAmount > grossWin) brokerageAmount = grossWin;
      bracketUseHierarchy = true;
    } else {
      const profitBeforeFee = grossWin - stakeAmt;
      const pct = Number(trade.brokeragePercent);
      brokerageAmount =
        Number.isFinite(pct) && pct > 0
          ? parseFloat(((profitBeforeFee * pct) / 100).toFixed(2))
          : 0;
    }
    profit = parseFloat((grossWin - stakeAmt).toFixed(2));
  }

  if (!Number.isFinite(profit)) {
    profit = status === 'lost' ? -(Number.isFinite(stakeAmt) ? stakeAmt : 0) : 0;
  }
  if (!Number.isFinite(brokerageAmount)) brokerageAmount = 0;

  trade.status = status;
  trade.exitPrice = exitPrice;
  trade.profit = profit;
  trade.brokerageAmount = brokerageAmount;
  trade.resolvedAt = now;
  await trade.save();

  const stake = Number(trade.amount);
  const stakeSafe = Number.isFinite(stake) && stake > 0 ? stake : 0;

  let balanceInc = 0;
  let pnlInc = 0;
  if (status === 'won') {
    const credit = stakeSafe + profit;
    balanceInc = Number.isFinite(credit) ? credit : 0;
    pnlInc = Number.isFinite(profit) ? profit : 0;
  } else if (status === 'lost') {
    pnlInc = -stakeSafe;
  }

  const gwBracket = await atomicGamesWalletUpdate(User, userIdForTrade, {
    balance: balanceInc,
    usedMargin: -stakeSafe,
    realizedPnL: pnlInc,
    todayRealizedPnL: pnlInc,
  });

  const tvBracket =
    gcBr?.ticketPrice != null && Number.isFinite(Number(gcBr.ticketPrice))
      ? Number(gcBr.ticketPrice)
      : (gsBracket?.tokenValue || 300);
  const bracketStakeTickets = parseFloat((stakeSafe / tvBracket).toFixed(2));

  if (status === 'won') {
    const winCredit = stakeSafe + profit;
    console.log('[NIFTY BRACKET DEBUG] Winning trade settlement:', {
      tradeId: trade._id,
      userId: userIdForTrade,
      stake: stakeSafe,
      profit,
      winCredit,
      brokerageAmount,
      balanceBefore: gwBracket.balance - balanceInc,
      balanceAfter: gwBracket.balance,
      prediction: trade.prediction,
      entryPrice: trade.entryPrice,
      exitPrice,
      currentPrice: price,
      upperTarget: trade.upperTarget,
      lowerTarget: trade.lowerTarget
    });
    
    if (Number.isFinite(winCredit) && winCredit > 0) {
      await recordGamesWalletLedger(userIdForTrade, {
        gameId: 'niftyBracket',
        entryType: 'credit',
        amount: winCredit,
        balanceAfter: gwBracket.balance,
        description: 'Nifty Bracket — win (gross payout; hierarchy from pool)',
        orderPlacedAt: trade.createdAt,
        meta: {
          tradeId: trade._id,
          profit,
          brokerageAmount,
          grossPrizeHierarchy: bracketUseHierarchy,
          hierarchyPaidFromPoolExtra: brokerageAmount > 0,
          stake: stakeSafe,
          tickets: bracketStakeTickets,
          tokenValue: tvBracket,
        },
      });
      
      console.log('[NIFTY BRACKET DEBUG] Credit ledger entry created successfully');
    } else {
      console.warn('[NIFTY BRACKET DEBUG] Invalid winCredit amount:', winCredit);
    }
  } else {
    console.log('[NIFTY BRACKET DEBUG] Losing trade settlement:', {
      tradeId: trade._id,
      userId: userIdForTrade,
      stake: stakeSafe,
      status,
      prediction: trade.prediction,
      entryPrice: trade.entryPrice,
      exitPrice,
      currentPrice: price,
      upperTarget: trade.upperTarget,
      lowerTarget: trade.lowerTarget
    });
  }
  if (status === 'lost' && stakeSafe > 0) {
    const userDoc = await User.findById(userIdForTrade);
    if (userDoc) {
      await distributeGameProfit(userDoc, stakeSafe, 'NiftyBracket', trade._id?.toString(), 'niftyBracket');
    }
  }

  if (status === 'won' && bracketUserDoc) {
    if (bracketUseHierarchy && bracketGrossBreakdown && brokerageAmount > 0) {
      await creditNiftyJackpotGrossHierarchyFromPool(userIdForTrade, bracketUserDoc, bracketGrossBreakdown, {
        gameLabel: 'Nifty Bracket',
        gameKey: 'niftyBracket',
        logTag: 'NiftyBracketGrossHierarchy',
      });
    } else if (brokerageAmount > 0) {
      await distributeWinBrokerage(
        userIdForTrade,
        bracketUserDoc,
        brokerageAmount,
        'Nifty Bracket',
        'niftyBracket',
        {
          fundFromBtcPool: true,
          ledgerGameId: 'niftyBracket',
          skipUserRebate: true,
        }
      );
    }
  }

  const message = status === 'won' ? 'You won!' : 'You lost';

  return {
    message,
    newBalance: gwBracket.balance,
    trade: {
      _id: trade._id,
      status: trade.status,
      exitPrice: trade.exitPrice,
      profit: trade.profit,
      brokerageAmount: trade.brokerageAmount,
    },
  };
}
