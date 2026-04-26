/**
 * Per-game "first win" for referral: each `gameType` (GameSettings key) is independent.
 * Users who already had the legacy single `firstGameWin` flag get all game keys set so
 * they do not double-earn when rolling out this behavior.
 */
export const REFERRAL_FIRST_WIN_GAME_KEYS = [
  'btcUpDown',
  'niftyUpDown',
  'niftyNumber',
  'niftyBracket',
  'niftyJackpot',
  'btcJackpot',
  'btcNumber',
];

/**
 * @param {import('../models/User.js').default|any} referredUser
 * @returns {boolean} true if a save() is needed
 */
export function migrateLegacyFirstGameWin(referredUser) {
  if (!referredUser?.referralStats) referredUser.referralStats = {};
  const st = referredUser.referralStats;
  st.firstGameWinByGame =
    st.firstGameWinByGame && typeof st.firstGameWinByGame === 'object' && !Array.isArray(st.firstGameWinByGame)
      ? { ...st.firstGameWinByGame }
      : {};
  if (st.firstGameWin !== true) return false;
  if (Object.keys(st.firstGameWinByGame).length > 0) return false;
  for (const k of REFERRAL_FIRST_WIN_GAME_KEYS) {
    st.firstGameWinByGame[k] = true;
  }
  return true;
}

export function hasFirstWinInGame(referredUser, gameType) {
  const m = referredUser?.referralStats?.firstGameWinByGame;
  return !!(m && typeof m === 'object' && m[gameType] === true);
}

export function markFirstWinInGame(referredUser, gameType) {
  referredUser.referralStats = referredUser.referralStats || {};
  referredUser.referralStats.firstGameWinByGame = referredUser.referralStats.firstGameWinByGame || {};
  referredUser.referralStats.firstGameWinByGame[gameType] = true;
  if (referredUser.markModified) {
    referredUser.markModified('referralStats');
    referredUser.markModified('referralStats.firstGameWinByGame');
  }
}
