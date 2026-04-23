/**
 * Calendar date YYYY-MM-DD in Asia/Kolkata.
 */
export function getTodayISTString(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** End instant (exclusive) of IST calendar day for key YYYY-MM-DD */
export function endOfISTDayFromKey(yyyyMmDd) {
  const start = startOfISTDayFromKey(yyyyMmDd);
  if (!start) return null;
  return new Date(start.getTime() + 86400000);
}

/** Start of that IST calendar day as a Date (instant of 00:00 IST). */
export function startOfISTDayFromKey(yyyyMmDd) {
  const [y, m, d] = String(yyyyMmDd)
    .split('-')
    .map((x) => parseInt(x, 10));
  if (!y || !m || !d) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return new Date(`${y}-${pad(m)}-${pad(d)}T00:00:00+05:30`);
}

/** Convert IST day key and seconds offset to timestamp in milliseconds */
export function istInstantMs(yyyyMmDd, secondsFromMidnight) {
  const start = startOfISTDayFromKey(yyyyMmDd);
  if (!start) return null;
  return start.getTime() + (secondsFromMidnight * 1000);
}
