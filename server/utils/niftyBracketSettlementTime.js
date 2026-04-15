/**
 * Next Nifty Bracket settlement instant in Asia/Kolkata as a JavaScript Date.
 * If "now" in IST is before today's resultTime, returns today at resultTime IST.
 * Otherwise returns the next calendar day at resultTime IST.
 *
 * @param {string} resultTimeStr - "HH:mm" or "HH:mm:ss" (IST), default 15:31
 */
export function getNextBracketSettlementDateIST(resultTimeStr = '15:31') {
  const parts = String(resultTimeStr || '15:31').trim().split(':');
  const targetH = Math.min(23, Math.max(0, parseInt(parts[0], 10) || 15));
  const targetM = Math.min(59, Math.max(0, parseInt(parts[1], 10) || 0));
  const targetS =
    parts.length >= 3 ? Math.min(59, Math.max(0, parseInt(parts[2], 10) || 0)) : 0;

  const now = new Date();
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const fp = f.formatToParts(now);
  const g = (t) => parseInt(fp.find((p) => p.type === t).value, 10);
  const y = g('year');
  const mo = g('month');
  const d = g('day');

  const pad = (n) => String(n).padStart(2, '0');
  const istIso = `${y}-${pad(mo)}-${pad(d)}T${pad(targetH)}:${pad(targetM)}:${pad(targetS)}+05:30`;
  let settlement = new Date(istIso);
  while (settlement.getTime() <= now.getTime()) {
    settlement = new Date(settlement.getTime() + 86400000);
  }
  return settlement;
}
