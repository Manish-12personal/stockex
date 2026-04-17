/** Prefer bet/trade placement time from ledger meta; fallback to row creation (e.g. legacy rows). */
export function gamesLedgerOrderMs(row) {
  const o = row?.meta?.orderPlacedAt;
  if (o) {
    const t = new Date(o).getTime();
    if (!Number.isNaN(t)) return t;
  }
  if (row?.createdAt) {
    const t = new Date(row.createdAt).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return null;
}

export function formatGamesLedgerWhen(row) {
  const ms = gamesLedgerOrderMs(row);
  if (ms == null) return '—';
  return new Date(ms).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
