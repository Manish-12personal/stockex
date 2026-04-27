const FNO_TYPES = new Set(['FUTURES', 'OPTIONS', 'FUT', 'OPT', 'OPTION']);

export function isFnoInstrumentType(t) {
  if (!t) return false;
  return FNO_TYPES.has(String(t).toUpperCase());
}

/**
 * Dated F&O contract whose expiry is strictly before `now` (hidden from user lists / watchlist).
 * Missing expiry on an F&O row is treated as not expired (perpetuals / bad data).
 */
export function isExpiredDerivative({ instrumentType, expiry }, now = new Date()) {
  if (!isFnoInstrumentType(instrumentType)) return false;
  if (expiry == null) return false;
  return new Date(expiry) < now;
}

/**
 * Mutates `query` (Mongo filter) to exclude F&O rows with `expiry` in the past.
 */
export function addActiveDerivExpiryToQuery(query, now = new Date()) {
  if (!query.$and) query.$and = [];
  query.$and.push({
    $or: [
      { instrumentType: { $nin: ['FUTURES', 'OPTIONS'] } },
      { expiry: null },
      { expiry: { $exists: false } },
      { expiry: { $gte: now } }
    ]
  });
  return query;
}

export function watchlistItemIsExpired(item, dbRow) {
  const type = (dbRow && dbRow.instrumentType) || item.instrumentType;
  const expiry = dbRow && dbRow.expiry != null ? dbRow.expiry : item.expiry;
  return isExpiredDerivative({ instrumentType: type, expiry });
}
