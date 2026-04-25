import { getCryptoPrice } from '../services/binanceWebSocket.js';
import { fetchBtcUsdtSpotRest } from './binanceBtcKline.js';

/**
 * Live BTC/USDT spot for BTC Jackpot leaderboard and 23:30 IST close lock.
 * WebSocket first (lowest latency) → Binance REST as fallback.
 *
 * @returns {Promise<{ price: number|null, source: 'binance_ws'|'binance_rest'|null }>}
 */
export async function getLiveBtcSpotForJackpot() {
  const ws = getCryptoPrice('BTCUSDT') || getCryptoPrice('BTC');
  const wsPrice = Number(ws?.ltp);
  if (Number.isFinite(wsPrice) && wsPrice > 0) {
    return { price: wsPrice, source: 'binance_ws' };
  }

  const restPrice = await fetchBtcUsdtSpotRest();
  if (Number.isFinite(restPrice) && restPrice > 0) {
    return { price: Number(restPrice), source: 'binance_rest' };
  }

  return { price: null, source: null };
}
