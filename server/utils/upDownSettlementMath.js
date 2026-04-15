/**
 * Authoritative Up/Down win from settlement prices (tie → loss).
 * Returns null if prices are unusable.
 */
export function settleUpDownFromPrices(prediction, openPrice, closePrice) {
  if (!['UP', 'DOWN'].includes(prediction)) return null;
  const op = Number(openPrice);
  const cl = Number(closePrice);
  if (!Number.isFinite(op) || !Number.isFinite(cl) || op <= 0 || cl <= 0) return null;
  const diff = cl - op;
  const marketUp = diff > 0;
  const marketDown = diff < 0;
  if (!marketUp && !marketDown) return false;
  return (prediction === 'UP' && marketUp) || (prediction === 'DOWN' && marketDown);
}

/**
 * Win payout: brokerage T = brokeragePercent% of (grossWin − stake).
 * User games wallet is credited full grossWin (not grossWin − T). SA BTC pool is debited separately for the payout
 * and again for T; hierarchy splits T via distributeWinBrokerage (not stacked % on gross).
 * Net-to-user after T is intentionally not applied here.
 */
export function computeUpDownWinPayout(amount, winMult, brokeragePercent) {
  const grossWin = amount * winMult;
  const profitBeforeFee = grossWin - amount;
  const pct = Number(brokeragePercent);
  const brokerage =
    Number.isFinite(pct) && pct > 0
      ? parseFloat(((profitBeforeFee * pct) / 100).toFixed(2))
      : 0;
  const creditTotal = parseFloat(Number(grossWin).toFixed(2));
  const pnl = parseFloat((grossWin - amount).toFixed(2));
  return { grossWin, brokerage, creditTotal, pnl };
}
