/**
 * Admin wallet ledger: filter GAME_PROFIT by game (GameSettings key).
 * Legacy rows match by description prefix before meta.gameKey existed.
 */

export const WALLET_LEDGER_GAME_OPTIONS = [
  { key: 'niftyUpDown', label: 'Nifty Up/Down' },
  { key: 'btcUpDown', label: 'BTC Up/Down' },
  { key: 'niftyNumber', label: 'Nifty Number' },
  { key: 'niftyBracket', label: 'Nifty Bracket' },
  { key: 'niftyJackpot', label: 'Nifty Jackpot' },
  { key: 'btcJackpot', label: 'BTC Jackpot' },
  { key: 'btcNumber', label: 'BTC Number' },
];

const LEGACY_GAME_PROFIT_PREFIXES = {
  niftyUpDown: ['Nifty UpDown', 'Nifty Up/Down'],
  btcUpDown: ['BTC UpDown', 'BTC Up/Down'],
  niftyNumber: ['NiftyNumber', 'Nifty Number'],
  niftyBracket: ['NiftyBracket', 'Nifty Bracket'],
  niftyJackpot: ['Nifty Jackpot'],
  btcJackpot: ['BTC Jackpot'],
  btcNumber: ['BtcNumber', 'BTC Number'],
};

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const KNOWN_KEYS = new Set(WALLET_LEDGER_GAME_OPTIONS.map((o) => o.key));

/**
 * Mongo fragment to AND with { ownerType, ownerId }.
 * Empty object = no game filter (all transactions).
 */
export function matchAdminLedgerGameKey(gameKey) {
  const gk = String(gameKey || '').trim();
  if (!gk || gk === 'all' || !KNOWN_KEYS.has(gk)) return {};

  const prefixes = LEGACY_GAME_PROFIT_PREFIXES[gk];
  const byMeta = { 'meta.gameKey': gk };
  if (!prefixes?.length) return byMeta;

  const legacyRegex = new RegExp(`^(${prefixes.map(escapeRegex).join('|')})`);
  return {
    $or: [byMeta, { reason: 'GAME_PROFIT', description: legacyRegex }],
  };
}
