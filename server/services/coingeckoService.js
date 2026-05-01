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
