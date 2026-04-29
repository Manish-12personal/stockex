/**
 * Nifty Number / BTC Number: gross prize credited to wallet on win.
 * Primary: (ticketPrice || settings.tokenValue) × winMultiplier × quantity
 * Else: fixedProfit × quantity (legacy), or 4000 × qty if fixedProfit unset.
 */
export function computeDecimalNumberWinGrossPrize(gameConfig, settings, quantity) {
  const q = Math.max(1, Number(quantity) || 1);

  const tokenValue =
    settings?.tokenValue != null &&
    Number.isFinite(Number(settings.tokenValue)) &&
    Number(settings.tokenValue) > 0
      ? Number(settings.tokenValue)
      : 300;

  const ticketPx =
    gameConfig?.ticketPrice != null &&
    Number.isFinite(Number(gameConfig.ticketPrice)) &&
    Number(gameConfig.ticketPrice) > 0
      ? Number(gameConfig.ticketPrice)
      : tokenValue;

  const mult = Number(gameConfig?.winMultiplier);
  if (Number.isFinite(mult) && mult > 0) {
    return parseFloat((ticketPx * mult * q).toFixed(2));
  }

  const fp = Number(gameConfig?.fixedProfit);
  const fixedFallback = Number.isFinite(fp) && fp > 0 ? fp : 4000;
  return parseFloat((fixedFallback * q).toFixed(2));
}
