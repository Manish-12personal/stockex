import GamesWalletLedger from '../models/GamesWalletLedger.js';

/** Normalize to ISO string for meta.orderPlacedAt (bet/trade placement instant). */
export function orderPlacedAtToIso(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const GAMES_WALLET_GAME_LABELS = {
  updown: 'Nifty Up/Down',
  btcupdown: 'BTC Up/Down',
  niftyNumber: 'Nifty Number',
  niftyBracket: 'Nifty Bracket',
  niftyJackpot: 'Nifty Jackpot',
  btcJackpot: 'BTC Jackpot',
  btcNumber: 'BTC Number',
  transfer_in: 'Main wallet → Games',
  transfer_out: 'Games → Main wallet',
};

/**
 * Append a games-wallet ledger row (non-blocking on failure — logs only).
 */
export async function recordGamesWalletLedger(userId, payload) {
  const {
    gameId = '',
    entryType,
    amount,
    balanceAfter,
    description = '',
    meta: rawMeta = {},
    orderPlacedAt: payloadOrderPlacedAt,
  } = payload;

  if (!userId || !entryType || !Number.isFinite(Number(amount)) || !Number.isFinite(Number(balanceAfter))) {
    console.warn('[GamesWalletLedger] skip invalid payload', payload);
    return;
  }

  const meta = { ...rawMeta };
  const explicit =
    orderPlacedAtToIso(meta.orderPlacedAt) ?? orderPlacedAtToIso(payloadOrderPlacedAt);
  if (explicit) {
    // Store as Date in Mongo (Mixed) so ledger date $expr compares correctly with IST day bounds.
    meta.orderPlacedAt = new Date(explicit);
  } else if (entryType === 'debit') {
    meta.orderPlacedAt = new Date();
  }

  try {
    await GamesWalletLedger.create({
      user: userId,
      gameId,
      gameLabel: GAMES_WALLET_GAME_LABELS[gameId] || (gameId ? String(gameId) : 'Games'),
      entryType,
      amount: Math.abs(Number(amount)),
      balanceAfter: Number(balanceAfter),
      description,
      meta,
    });
  } catch (e) {
    console.error('[GamesWalletLedger]', e.message);
  }
}
