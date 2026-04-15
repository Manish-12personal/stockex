/**
 * NSE cash session in Asia/Kolkata (Mon–Fri 09:15–15:30 IST).
 */

const parseTimeToSec = (timeStr) => {
  const parts = (timeStr || '').split(':').map(Number);
  return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
};

export const getTotalSecondsIST = () => {
  const t = new Date().toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
  });
  const parts = t.split(':').map((x) => parseInt(x, 10));
  const h = parts[0] || 0;
  const m = parts[1] || 0;
  const s = parts[2] || 0;
  return h * 3600 + m * 60 + s;
};

export const isWeekendIST = () => {
  const wd = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  });
  return wd === 'Sat' || wd === 'Sun';
};

/** NSE cash Mon–Fri 9:15–15:30 IST */
export const isNseCashMarketOpenIST = () => {
  if (isWeekendIST()) return false;
  const sec = getTotalSecondsIST();
  const open = parseTimeToSec('09:15:00');
  const close = parseTimeToSec('15:30:00');
  return sec >= open && sec < close;
};
