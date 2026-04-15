/**
 * Parse "HH:mm" or "HH:mm:ss" to seconds since midnight (wall clock, used with IST day anchor).
 */
export function parseTimeStringToSec(str) {
  const parts = String(str ?? '09:15:00')
    .trim()
    .split(':')
    .map((x) => parseInt(x, 10));
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
}
