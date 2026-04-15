/**
 * Crypto-style margin / leverage helpers (notional vs margin posted).
 *
 * @typedef {Object} CryptoMarginLeverageResult
 * @property {number|null} leverage - tradeValue / investedAmount (effective exposure multiple)
 * @property {number|null} requiredMargin - tradeValue / leverage (equals investedAmount when inputs valid)
 * @property {number|null} liquidationRiskPercentage - approximate adverse move to wipe margin: 100 / leverage (%)
 * @property {'NORMAL'|'HIGH'|'VERY HIGH'|'INVALID'} riskLevel - HIGH if leverage > 20, VERY HIGH if > 50
 */

const round = (n, decimals = 6) => {
  if (!Number.isFinite(n)) return null;
  const p = 10 ** decimals;
  return Math.round(n * p) / p;
};

/**
 * @param {number} investedAmount - Capital/margin allocated to the trade (same unit as tradeValue)
 * @param {number} tradeValue - Full notional position size
 * @returns {CryptoMarginLeverageResult}
 */
export function calculateCryptoMarginAndLeverage(investedAmount, tradeValue) {
  const inv = Number(investedAmount);
  const tv = Number(tradeValue);

  if (!Number.isFinite(inv) || !Number.isFinite(tv) || inv <= 0 || tv < 0) {
    return {
      leverage: null,
      requiredMargin: null,
      liquidationRiskPercentage: null,
      riskLevel: 'INVALID',
    };
  }

  const leverage = tv / inv;
  const requiredMargin = tv / leverage;
  const liquidationRiskPercentage = leverage > 0 ? 100 / leverage : null;

  let riskLevel = 'NORMAL';
  if (leverage > 50) riskLevel = 'VERY HIGH';
  else if (leverage > 20) riskLevel = 'HIGH';

  return {
    leverage: round(leverage, 8),
    requiredMargin: round(requiredMargin, 8),
    liquidationRiskPercentage:
      liquidationRiskPercentage == null ? null : round(liquidationRiskPercentage, 8),
    riskLevel,
  };
}
