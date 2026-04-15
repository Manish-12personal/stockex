/**
 * NSE F&O Market Watch: infer underlying from Angel-style symbols and bucket into broad sectors
 * (Nifty 50–heavy; extend UNDERLYING_TO_SECTOR as needed).
 */

/** Preferred accordion order; unknown sectors append at end. */
export const NSE_FNO_SECTOR_ORDER = [
  'Indices',
  'Banking',
  'IT & Technology',
  'Oil, Gas & Energy',
  'FMCG',
  'Auto',
  'Pharma & Healthcare',
  'Metals & Mining',
  'Infrastructure & Construction',
  'Financial Services (ex-Banks)',
  'Telecom',
  'Power & Utilities',
  'Consumer',
  'Chemicals & Agri',
  'Media & Entertainment',
  'Other',
];

/** Map canonical underlying (uppercase A–Z digits only) → sector label. */
const UNDERLYING_TO_SECTOR = {
  NIFTY: 'Indices',
  BANKNIFTY: 'Indices',
  FINNIFTY: 'Indices',
  MIDCPNIFTY: 'Indices',
  NIFTYIT: 'Indices',
  HDFCBANK: 'Banking',
  ICICIBANK: 'Banking',
  SBIN: 'Banking',
  KOTAKBANK: 'Banking',
  AXISBANK: 'Banking',
  INDUSINDBK: 'Banking',
  TCS: 'IT & Technology',
  INFY: 'IT & Technology',
  HCLTECH: 'IT & Technology',
  WIPRO: 'IT & Technology',
  TECHM: 'IT & Technology',
  LTIM: 'IT & Technology',
  RELIANCE: 'Oil, Gas & Energy',
  ONGC: 'Oil, Gas & Energy',
  BPCL: 'Oil, Gas & Energy',
  COALINDIA: 'Oil, Gas & Energy',
  ITC: 'FMCG',
  HINDUNILVR: 'FMCG',
  BRITANNIA: 'FMCG',
  NESTLEIND: 'FMCG',
  TATACONSUM: 'FMCG',
  MARUTI: 'Auto',
  TATAMOTORS: 'Auto',
  'M&M': 'Auto',
  HEROMOTOCO: 'Auto',
  EICHERMOT: 'Auto',
  BAJAJAUTO: 'Auto',
  SUNPHARMA: 'Pharma & Healthcare',
  DRREDDY: 'Pharma & Healthcare',
  CIPLA: 'Pharma & Healthcare',
  DIVISLAB: 'Pharma & Healthcare',
  APOLLOHOSP: 'Pharma & Healthcare',
  TATASTEEL: 'Metals & Mining',
  JSWSTEEL: 'Metals & Mining',
  HINDALCO: 'Metals & Mining',
  ULTRACEMCO: 'Infrastructure & Construction',
  LT: 'Infrastructure & Construction',
  GRASIM: 'Infrastructure & Construction',
  BAJFINANCE: 'Financial Services (ex-Banks)',
  BAJAJFINSV: 'Financial Services (ex-Banks)',
  SBILIFE: 'Financial Services (ex-Banks)',
  HDFCLIFE: 'Financial Services (ex-Banks)',
  BHARTIARTL: 'Telecom',
  NTPC: 'Power & Utilities',
  POWERGRID: 'Power & Utilities',
  ADANIENT: 'Consumer',
  ADANIPORTS: 'Consumer',
  ASIANPAINT: 'Chemicals & Agri',
  UPL: 'Chemicals & Agri',
  TITAN: 'Consumer',
};

const INDEX_PREFIXES = ['MIDCPNIFTY', 'BANKNIFTY', 'FINNIFTY', 'NIFTYIT', 'NIFTY'];

function normalizeSym(raw) {
  return String(raw || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Best-effort underlying root for NFO futures/options (e.g. BPCL26JUNFUT → BPCL).
 */
export function inferNseFnoUnderlying(tradingSymbol, symbol) {
  const raw = String(tradingSymbol || symbol || '').toUpperCase();
  if (raw.includes('M&M')) return 'M&M';
  const s = normalizeSym(tradingSymbol || symbol);
  if (!s) return 'OTHER';
  for (const p of INDEX_PREFIXES) {
    if (s.startsWith(p)) return p;
  }
  const m = s.match(/^([A-Z]{2,}?)\d/);
  if (m) return m[1];
  const m2 = s.match(/^([A-Z]{2,})/);
  return m2 ? m2[1] : 'OTHER';
}

export function getNseFnOSectorLabel(inst) {
  const u = inferNseFnoUnderlying(inst?.tradingSymbol, inst?.symbol);
  return UNDERLYING_TO_SECTOR[u] || 'Other';
}

/**
 * @param {Array<Record<string, unknown>>} instruments
 * @returns {{ sector: string, items: typeof instruments }[]}
 */
export function groupNseFoMarketWatch(instruments) {
  const buckets = new Map();
  for (const inst of instruments) {
    const sec = getNseFnOSectorLabel(inst);
    if (!buckets.has(sec)) buckets.set(sec, []);
    buckets.get(sec).push(inst);
  }
  const out = [];
  for (const label of NSE_FNO_SECTOR_ORDER) {
    const items = buckets.get(label);
    if (items?.length) out.push({ sector: label, items });
    buckets.delete(label);
  }
  for (const [sector, items] of buckets) {
    if (items?.length) out.push({ sector, items });
  }
  return out;
}
