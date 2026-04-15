/**
 * USD→INR rate for crypto spot economics (wallet, notionals, stored trade prices in INR).
 * Align with ops via env; optional live rate is only for display (/api/exchange-rate/usdinr).
 */
export function getUsdInrRate() {
  const fromEnv = Number(process.env.USD_INR || process.env.INR_PER_USD);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return fromEnv;
  return 83;
}
