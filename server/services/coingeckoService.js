import axios from 'axios';

const CG_BASE =
  process.env.COINGECKO_API_BASE?.trim() || 'https://api.coingecko.com/api/v3';

/** USDT base → CoinGecko id (spot synthetic quotes; UI still labelled BINANCE). */
const CG_ID_BY_USDT_BASE = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  SOL: 'solana',
  DOT: 'polkadot',
  POL: 'matic-network',
  MATIC: 'matic-network',
  LTC: 'litecoin',
  AVAX: 'avalanche-2',
  LINK: 'chainlink',
  ATOM: 'cosmos',
  UNI: 'uniswap',
  XLM: 'stellar',
};

function cgAuthHeaders() {
  const key = process.env.COINGECKO_API_KEY?.trim();
  if (!key) return {};
  const pro = /^https:\/\/pro-api\.coingecko\.com/i.test(CG_BASE);
  return pro ? { 'x-cg-pro-api-key': key } : { 'x-cg-demo-api-key': key };
}

export function coinGeckoConfigured() {
  return !!process.env.COINGECKO_API_KEY?.trim();
}

export function resolveCoinGeckoId(rawSymbol) {
  const s = String(rawSymbol || '').trim();
  if (!s) return null;
  const u = s.toUpperCase().replace(/USDT|BUSD|FDUSD$/i, '');
  return CG_ID_BY_USDT_BASE[u] || null;
}

function uniqueTrackedIds() {
  return [...new Set(Object.values(CG_ID_BY_USDT_BASE))];
}

function rowFromSimpleEntry(base, vals) {
  const pair = `${base}USDT`;
  const usd = Number(vals?.usd);
  const ch = vals?.usd_24h_change != null ? Number(vals.usd_24h_change) : null;
  const vol = vals?.usd_24h_vol != null ? Number(vals.usd_24h_vol) : 0;
  const ltp = Number.isFinite(usd) ? usd : 0;
  const prev =
    ch != null && Number.isFinite(ch) && Math.abs(ch) < 200 && ltp > 0
      ? ltp / (1 + ch / 100)
      : ltp;
  const change = Number.isFinite(prev) && prev > 0 ? ltp - prev : 0;
  const changePercent = ch != null && Number.isFinite(ch) ? ch.toFixed(2) : '0.00';

  return {
    symbol: base,
    pair,
    exchange: 'BINANCE',
    ltp,
    open: prev,
    high: ltp,
    low: ltp,
    close: ltp,
    change,
    changePercent,
    volume: vol,
    quoteVolume: vol,
    lastUpdated: new Date(),
  };
}

export async function fetchAggregatedPricesObject() {
  const ids = uniqueTrackedIds().join(',');
  const { data } = await axios.get(`${CG_BASE}/simple/price`, {
    params: {
      ids,
      vs_currencies: 'usd',
      include_24hr_change: true,
      include_24hr_vol: true,
    },
    headers: cgAuthHeaders(),
    timeout: 20000,
  });

  const idToBase = {};
  for (const [base, id] of Object.entries(CG_ID_BY_USDT_BASE)) {
    if (!idToBase[id]) idToBase[id] = base;
  }

  const cryptoData = {};
  for (const [cgId, vals] of Object.entries(data || {})) {
    const base = idToBase[cgId];
    if (!base) continue;
    const pair = `${base}USDT`;
    cryptoData[pair] = rowFromSimpleEntry(base, vals);
  }
  return cryptoData;
}

export async function fetchSimplePriceForBaseSymbol(symbolParam) {
  const id = resolveCoinGeckoId(symbolParam);
  if (!id) throw new Error(`Unknown CoinGecko mapping for ${symbolParam}`);

  const { data } = await axios.get(`${CG_BASE}/simple/price`, {
    params: {
      ids: id,
      vs_currencies: 'usd',
      include_24hr_change: true,
      include_24hr_vol: true,
    },
    headers: cgAuthHeaders(),
    timeout: 20000,
  });
  const vals = data[id];
  if (!vals) throw new Error(`No CoinGecko price for ${id}`);

  const u = String(symbolParam || '').toUpperCase().replace(/USDT|BUSD|FDUSD$/i, '');
  const base = CG_ID_BY_USDT_BASE[u]
    ? u
    : Object.entries(CG_ID_BY_USDT_BASE).find(([, v]) => v === id)?.[0];
  if (!base) throw new Error(`Cannot resolve base for ${symbolParam}`);
  return rowFromSimpleEntry(base, vals);
}

export function coingeckoOhlcDays(interval) {
  const i = String(interval || '15m').toLowerCase();
  if (i === '1m' || i === '3m' || i === '5m') return '1';
  if (i === '15m' || i === '30m' || i === '1h' || i === '2h') return '7';
  if (i === '4h' || i === '6h' || i === '8h' || i === '12h') return '30';
  if (i === '1d' || i === '3d' || i === '1w') return '365';
  return '30';
}

export async function fetchOhlcCandlesUsd(symbolParam, interval) {
  const id = resolveCoinGeckoId(symbolParam);
  if (!id) throw new Error(`Unknown CoinGecko mapping for ${symbolParam}`);

  const days = coingeckoOhlcDays(interval);
  const { data } = await axios.get(`${CG_BASE}/coins/${encodeURIComponent(id)}/ohlc`, {
    params: { vs_currency: 'usd', days },
    headers: cgAuthHeaders(),
    timeout: 25000,
  });

  if (!Array.isArray(data)) return [];

  return data.map((k) => ({
    time: Math.floor(Number(k[0]) / 1000),
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: 0,
  }));
}

/** BTC spot USD — Binance REST/WebSocket unavailable (e.g. HTTP 451). */
export async function fetchBtcSimpleUsd() {
  const { data } = await axios.get(`${CG_BASE}/simple/price`, {
    params: { ids: 'bitcoin', vs_currencies: 'usd' },
    headers: cgAuthHeaders(),
    timeout: 12000,
  });
  const p = data?.bitcoin?.usd;
  return Number.isFinite(Number(p)) ? Number(p) : null;
}

/** `[[ms, price], ...]` — CoinGecko `market_chart/range` (`from`/`to` in unix seconds). */
export async function fetchBtcUsdPricesInRangeMs(fromMs, toMs) {
  const from = Math.floor(fromMs / 1000);
  const to = Math.floor(toMs / 1000);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const { data } = await axios.get(`${CG_BASE}/coins/bitcoin/market_chart/range`, {
    params: { vs_currency: 'usd', from, to },
    headers: cgAuthHeaders(),
    timeout: 18000,
  });
  return Array.isArray(data?.prices) ? data.prices : [];
}

export function pickUsdPriceNearestMs(targetMs, pricePoints) {
  if (!Array.isArray(pricePoints) || pricePoints.length === 0) return null;
  let best = null;
  let bestAbs = Infinity;
  for (const pt of pricePoints) {
    const t = Number(pt[0]);
    const p = Number(pt[1]);
    if (!Number.isFinite(t) || !Number.isFinite(p) || p <= 0) continue;
    const d = Math.abs(t - targetMs);
    if (d < bestAbs) {
      bestAbs = d;
      best = p;
    }
  }
  return best;
}

/** First / last USD sample whose timestamps fall inside [t0Ms, t1Ms] (inclusive). */
export function openCloseFromUsdPricesInWindow(pricePoints, t0Ms, t1Ms) {
  if (!Array.isArray(pricePoints) || pricePoints.length === 0) return null;
  const inWin = pricePoints
    .map((pt) => ({ t: Number(pt[0]), p: Number(pt[1]) }))
    .filter(
      (x) =>
        Number.isFinite(x.t) &&
        Number.isFinite(x.p) &&
        x.p > 0 &&
        x.t >= t0Ms &&
        x.t <= t1Ms,
    )
    .sort((a, b) => a.t - b.t);
  if (inWin.length === 0) return null;
  return { open: inWin[0].p, close: inWin[inWin.length - 1].p };
}

export async function searchCoinsQuery(query) {
  const q = String(query || '').trim();
  const { data } = await axios.get(`${CG_BASE}/search`, {
    params: { query: q },
    headers: cgAuthHeaders(),
    timeout: 15000,
  });
  const coins = Array.isArray(data?.coins) ? data.coins : [];
  return coins.slice(0, 20).map((c) => {
    const sym = String(c.symbol || '').toUpperCase();
    return {
      symbol: sym,
      pair: sym ? `${sym}USDT` : '',
      exchange: 'BINANCE',
      coingeckoId: c.id,
      name: c.name || sym,
    };
  });
}
