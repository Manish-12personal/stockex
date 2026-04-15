import GamesWalletLedger from '../models/GamesWalletLedger.js';
import { startOfISTDayFromKey, endOfISTDayFromKey } from './istDate.js';

function ticketUnitsFromLedgerRow(row, fallbackTokenValue) {
  const t = Number(row?.meta?.tickets);
  if (Number.isFinite(t) && t > 0) return t;
  const amt = Number(row?.amount);
  const tv = Number(row?.meta?.tokenValue);
  const useTv = Number.isFinite(tv) && tv > 0 ? tv : Number(fallbackTokenValue) || 300;
  if (Number.isFinite(amt) && useTv > 0) return amt / useTv;
  return 0;
}

/**
 * Sum ticket units already staked on UP or DOWN for this window (IST calendar day scope).
 */
export async function sumUpDownSideTicketsInWindow(userId, gameId, windowNumber, prediction, istDayKey) {
  const wn = Number(windowNumber);
  if (!Number.isFinite(wn) || wn < 1) return 0;
  const pred = prediction === 'DOWN' ? 'DOWN' : 'UP';
  const dayStart = startOfISTDayFromKey(istDayKey);
  const dayEnd = endOfISTDayFromKey(istDayKey);
  if (!dayStart || !dayEnd) return 0;

  const rows = await GamesWalletLedger.find({
    user: userId,
    gameId,
    entryType: 'debit',
    $or: [{ 'meta.windowNumber': wn }, { 'meta.windowNumber': String(wn) }],
    'meta.prediction': pred,
    description: { $regex: /Up\/Down.*bet/i },
    createdAt: { $gte: dayStart, $lt: dayEnd },
  })
    .select('meta amount')
    .lean();

  let sum = 0;
  for (const r of rows) {
    sum += ticketUnitsFromLedgerRow(r, null);
  }
  return sum;
}

/**
 * Sum ticket units on BUY or SELL for Nifty Bracket in an IST calendar day.
 */
export async function sumBracketSideTicketsInDay(userId, prediction, istDayKey, fallbackTokenValue) {
  const pred = prediction === 'SELL' ? 'SELL' : 'BUY';
  const dayStart = startOfISTDayFromKey(istDayKey);
  const dayEnd = endOfISTDayFromKey(istDayKey);
  if (!dayStart || !dayEnd) return 0;

  const rows = await GamesWalletLedger.find({
    user: userId,
    gameId: 'niftyBracket',
    entryType: 'debit',
    'meta.prediction': pred,
    description: { $regex: /Nifty Bracket — (BUY|SELL)/i },
    createdAt: { $gte: dayStart, $lt: dayEnd },
  })
    .select('meta amount')
    .lean();

  let sum = 0;
  for (const r of rows) {
    sum += ticketUnitsFromLedgerRow(r, fallbackTokenValue);
  }
  return sum;
}
