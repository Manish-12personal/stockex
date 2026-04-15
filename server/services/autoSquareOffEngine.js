/**
 * Auto square-off: margin vs exposure at LTP (`positions[].price` must be LTP).
 * FIFO allocation after fill (partial-fill safe).
 */

const EPS = 1e-9;

function isIntradayType(type) {
  const t = String(type || '').toUpperCase();
  return t === 'INTRADAY' || t === 'MIS' || t === 'MARGIN';
}

export function buyPowerForType(type, leverage) {
  const intra = Math.max(1, Number(leverage?.intradayMultiplier) || 1);
  const carry = Math.max(1, Number(leverage?.carryMultiplier) || 1);
  return isIntradayType(type) ? intra : carry;
}

/** Single-symbol bucket; prices = LTP. */
export function calculateReduction(input) {
  const walletBalance = Number(input.walletBalance) || 0;
  const m2mPnL = Number(input.m2mPnL) || 0;
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const leverage = input.leverage || {};
  const markPrice = Number(input.markPrice) || 0;

  const balance = walletBalance + m2mPnL;

  let totalExposure = 0;
  let requiredMargin = 0;
  let totalQty = 0;

  for (const p of positions) {
    const q = Math.max(0, Number(p.quantity) || 0);
    const pr = Math.max(0, Number(p.price) || 0);
    const mult = buyPowerForType(p.type, leverage);
    totalExposure += q * pr;
    requiredMargin += mult > EPS ? (q * pr) / mult : 0;
    totalQty += q;
  }

  const refPrice =
    markPrice > EPS ? markPrice : totalQty > EPS ? totalExposure / totalQty : 0;

  const base = {
    balance,
    walletBalance,
    m2mPnL,
    totalExposure,
    requiredMargin,
    totalQty,
    referencePrice: refPrice,
  };

  if (positions.length === 0) {
    return { ...base, shouldSquareOff: false, reason: 'no_positions' };
  }
  if (requiredMargin <= EPS) {
    return { ...base, shouldSquareOff: false, reason: 'zero_required_margin' };
  }

  if (balance >= requiredMargin - 1e-6) {
    const buyPowerEff = totalExposure / requiredMargin;
    return {
      ...base,
      shouldSquareOff: false,
      buyPowerEffective: buyPowerEff,
      maxAllowedExposure: balance * buyPowerEff,
    };
  }

  const buyPowerEff = totalExposure / requiredMargin;
  const maxAllowedExposure = balance * buyPowerEff;
  const reductionExposure = Math.max(0, totalExposure - maxAllowedExposure);
  const reductionQtyRaw = refPrice > EPS ? reductionExposure / refPrice : 0;
  const reductionQty = Math.min(Math.max(0, reductionQtyRaw), totalQty);

  return {
    ...base,
    shouldSquareOff: true,
    buyPowerEffective: buyPowerEff,
    maxAllowedExposure,
    reductionExposure,
    reductionQty,
  };
}

/** Portfolio; `positions[].price` = LTP. */
export function calculatePortfolioReduction(input) {
  const walletBalance = Number(input.walletBalance) || 0;
  const m2mPnL = Number(input.m2mPnL) || 0;
  const positions = Array.isArray(input.positions) ? input.positions : [];
  const leverage = input.leverage || {};
  const markPricesBySymbol =
    input.markPricesBySymbol && typeof input.markPricesBySymbol === 'object'
      ? input.markPricesBySymbol
      : {};

  const balance = walletBalance + m2mPnL;

  const bySym = new Map();
  let totalExposure = 0;
  let requiredMargin = 0;

  for (const p of positions) {
    const sym = String(p.symbol || '');
    const q = Math.max(0, Number(p.quantity) || 0);
    const pr =
      Math.max(0, Number(p.price) || 0) ||
      Math.max(0, Number(markPricesBySymbol[sym]) || 0);
    const mult = buyPowerForType(p.type, leverage);
    const exp = q * pr;
    totalExposure += exp;
    requiredMargin += mult > EPS ? exp / mult : 0;

    if (!bySym.has(sym)) {
      bySym.set(sym, { positions: [], exposure: 0, qty: 0, avgPrice: 0 });
    }
    const bucket = bySym.get(sym);
    bucket.positions.push(p);
    bucket.exposure += exp;
    bucket.qty += q;
  }

  for (const b of bySym.values()) {
    b.avgPrice =
      b.qty > EPS ? b.exposure / b.qty : Number(markPricesBySymbol[b.positions[0]?.symbol]) || 0;
  }

  if (positions.length === 0) {
    return {
      shouldSquareOff: false,
      balance,
      totalExposure: 0,
      requiredMargin: 0,
      perSymbol: [],
      reason: 'no_positions',
    };
  }

  if (requiredMargin <= EPS) {
    return {
      shouldSquareOff: false,
      balance,
      totalExposure,
      requiredMargin,
      perSymbol: [],
      reason: 'zero_required_margin',
    };
  }

  if (balance >= requiredMargin - 1e-6) {
    const buyPowerEff = totalExposure / requiredMargin;
    return {
      shouldSquareOff: false,
      balance,
      totalExposure,
      requiredMargin,
      buyPowerEffective: buyPowerEff,
      maxAllowedExposure: balance * buyPowerEff,
      perSymbol: [],
    };
  }

  const buyPowerEff = totalExposure / requiredMargin;
  const maxAllowedExposure = balance * buyPowerEff;
  const reductionExposureTotal = Math.max(0, totalExposure - maxAllowedExposure);

  const perSymbol = [];
  for (const [symbol, bucket] of bySym) {
    const share =
      totalExposure > EPS ? (bucket.exposure / totalExposure) * reductionExposureTotal : 0;
    const mk =
      Number(markPricesBySymbol[symbol]) > EPS
        ? Number(markPricesBySymbol[symbol])
        : bucket.avgPrice;
    const reductionQty = mk > EPS ? Math.min(share / mk, bucket.qty) : 0;
    perSymbol.push({
      symbol,
      positions: bucket.positions,
      exposure: bucket.exposure,
      reductionExposure: share,
      reductionQty,
      markPrice: mk,
    });
  }

  return {
    shouldSquareOff: true,
    balance,
    totalExposure,
    requiredMargin,
    buyPowerEffective: buyPowerEff,
    maxAllowedExposure,
    reductionExposureTotal,
    perSymbol,
  };
}

export function allocateReductionFifo(positions, filledQty) {
  const fq = Math.max(0, Number(filledQty) || 0);
  const sorted = [...positions].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return ta - tb;
  });

  let remaining = fq;
  const allocations = [];

  for (const p of sorted) {
    if (remaining <= EPS) break;
    const q = Math.max(0, Number(p.quantity) || 0);
    const reducible = Math.min(q, remaining);
    if (reducible <= EPS) continue;
    const newQty = q - reducible;
    allocations.push({
      id: p.id,
      symbol: p.symbol,
      reduced: reducible,
      remainingQty: newQty,
      closed: newQty <= EPS,
      createdAt: p.createdAt,
    });
    remaining -= reducible;
  }

  return { allocations, remainingUnallocated: remaining };
}

/**
 * @param {(o: { symbol: string, side: 'SELL'|'BUY', quantity: number, orderType: 'MARKET' }) => Promise<{ filledQty?: number, quantity?: number }|void>} [hooks.placeMarketOrder]
 */
export async function autoSquareOff(params, hooks = {}) {
  const plan = calculatePortfolioReduction(params);
  if (!plan.shouldSquareOff) {
    return { plan, executions: [] };
  }

  const executions = [];
  const place = hooks.placeMarketOrder;

  for (const row of plan.perSymbol) {
    if (!row.symbol || row.reductionQty <= EPS) {
      executions.push({ symbol: row.symbol, skipped: true, reason: 'zero_reduction', row });
      continue;
    }

    let filledQty = row.reductionQty;
    if (typeof place === 'function') {
      const exec = await place({
        symbol: row.symbol,
        side: 'SELL',
        quantity: row.reductionQty,
        orderType: 'MARKET',
      });
      filledQty = Math.max(
        0,
        Number(exec?.filledQty ?? exec?.quantity ?? row.reductionQty) || 0
      );
    }

    const fifo = allocateReductionFifo(row.positions, filledQty);
    executions.push({
      symbol: row.symbol,
      requestedQty: row.reductionQty,
      filledQty,
      fifo,
      row,
    });
  }

  return { plan, executions };
}

export default {
  buyPowerForType,
  calculateReduction,
  calculatePortfolioReduction,
  allocateReductionFifo,
  autoSquareOff,
};
