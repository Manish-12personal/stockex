import { getTodayISTString, startOfISTDayFromKey } from './istDate.js';

/** IST calendar day key after adding signed whole-day offsets from another IST day key. */
export function addISTCalendarDays(dayKey, deltaDays) {
  const start = startOfISTDayFromKey(dayKey);
  if (!start || !Number.isFinite(deltaDays)) return null;
  return getTodayISTString(new Date(start.getTime() + deltaDays * 86400000));
}

/** First IST calendar day key when daily platform charges apply (after graceDays free calendar days). */
export function firstBillablePlatformChargeDayKey(signupDate, graceDays) {
  const g = Number(graceDays);
  if (!Number.isFinite(g) || g < 0) return null;
  const signupKey = getTodayISTString(signupDate);
  return addISTCalendarDays(signupKey, g);
}

/** True if chargeDayKey (YYYY-MM-DD IST) is still inside grace relative to signup. */
export function isUserInPlatformChargeGrace(signupDate, graceDays, chargeDayKey) {
  const firstBillable = firstBillablePlatformChargeDayKey(signupDate, graceDays);
  if (!firstBillable || !chargeDayKey) return true;
  return chargeDayKey < firstBillable;
}
