/**
 * Commission type ↔ allowed amount unit (₹ vs %).
 * Reusable on API save paths and in brokerage math.
 */

export const COMMISSION_TYPES = ['PER_LOT', 'PER_QUANTITY', 'PER_TRADE', 'PER_CRORE'];

/** @param {'PER_LOT'|'PER_QUANTITY'|'PER_TRADE'|'PER_CRORE'} commissionType */
export function requiredUnitForCommissionType(commissionType) {
  if (commissionType === 'PER_CRORE') return 'PERCENT';
  if (commissionType === 'PER_LOT' || commissionType === 'PER_TRADE' || commissionType === 'PER_QUANTITY') {
    return 'INR';
  }
  return null;
}

/**
 * @param {'PER_LOT'|'PER_TRADE'|'PER_CRORE'} commissionType
 * @param {'INR'|'PERCENT'} unit
 * @returns {{ ok: boolean, error?: string }}
 */
export function validateCommissionTypeUnit(commissionType, unit) {
  const u = unit === 'PERCENT' || unit === 'INR' ? unit : null;
  if (!u) return { ok: false, error: `Invalid unit "${unit}" (use INR or PERCENT)` };
  const need = requiredUnitForCommissionType(commissionType);
  if (!need) return { ok: false, error: `Invalid commission type "${commissionType}"` };
  if (u !== need) {
    return {
      ok: false,
      error: `${commissionType} requires ${need === 'INR' ? 'fixed ₹ (INR)' : 'percentage (PERCENT)'}; got ${u}`,
    };
  }
  return { ok: true };
}

export function assertValidCommissionTypeUnit(commissionType, unit) {
  const r = validateCommissionTypeUnit(commissionType, unit);
  if (!r.ok) {
    const e = new Error(r.error);
    e.name = 'CommissionTypeUnitError';
    throw e;
  }
}

/**
 * Ensures segment slice has commissionUnit aligned with commissionType.
 * @param {Record<string, unknown>} seg
 * @returns {Record<string, unknown>}
 */
export function withAlignedSegmentCommissionUnit(seg) {
  if (!seg || typeof seg !== 'object') return seg;
  const out = { ...seg };
  const ct = out.commissionType || 'PER_LOT';
  out.commissionUnit = requiredUnitForCommissionType(ct);
  for (const key of ['optionBuy', 'optionSell']) {
    if (out[key] && typeof out[key] === 'object') {
      const opt = { ...out[key] };
      const oct = opt.commissionType || 'PER_LOT';
      opt.commissionUnit = requiredUnitForCommissionType(oct);
      out[key] = opt;
    }
  }
  return out;
}

/** Align every segment slice in a defaults map (plain object). */
export function alignSegmentDefaultsMap(segmentDefaults) {
  if (!segmentDefaults || typeof segmentDefaults !== 'object') return segmentDefaults;
  const out = { ...segmentDefaults };
  for (const k of Object.keys(out)) {
    if (out[k] && typeof out[k] === 'object') {
      out[k] = withAlignedSegmentCommissionUnit(normalizeLegacySystemSegmentDefaultsSlice(k, out[k]));
    }
  }
  return out;
}

/**
 * SystemSettings.segmentDefaults.MCX uses PER_QUANTITY, not PER_LOT. Older DB / clients may send PER_LOT.
 * @param {string} segmentKey - e.g. EQUITY, FNO, MCX
 * @param {Record<string, unknown>} seg
 */
export function normalizeLegacySystemSegmentDefaultsSlice(segmentKey, seg) {
  if (!seg || typeof seg !== 'object') return seg;
  const key = String(segmentKey || '').toUpperCase();
  if (key !== 'MCX') return seg;
  const out = { ...seg };
  const coerce = (ct) => (ct === 'PER_LOT' ? 'PER_QUANTITY' : ct);
  if (out.commissionType) out.commissionType = coerce(out.commissionType);
  for (const opt of ['optionBuy', 'optionSell']) {
    if (out[opt] && typeof out[opt] === 'object' && out[opt].commissionType != null) {
      out[opt] = { ...out[opt], commissionType: coerce(out[opt].commissionType) };
    }
  }
  return out;
}

/**
 * Validate segment permission / segment default object (throws on invalid explicit unit).
 * @param {Record<string, unknown>} seg
 */
export function assertSegmentCommissionUnitsValid(seg) {
  if (!seg || typeof seg !== 'object') return;
  const ct = seg.commissionType || 'PER_LOT';
  const cu = seg.commissionUnit;
  if (cu != null) assertValidCommissionTypeUnit(ct, cu);
  for (const key of ['optionBuy', 'optionSell']) {
    const opt = seg[key];
    if (!opt || typeof opt !== 'object') continue;
    const oct = opt.commissionType || 'PER_LOT';
    const ocu = opt.commissionUnit;
    if (ocu != null) assertValidCommissionTypeUnit(oct, ocu);
  }
}

/**
 * Walk system segmentDefaults or adminSegmentDefaults map.
 * @param {Record<string, Record<string, unknown>>} segmentMap
 */
export function assertSegmentDefaultsCommissionBlocks(segmentMap) {
  if (!segmentMap || typeof segmentMap !== 'object') return;
  for (const segKey of Object.keys(segmentMap)) {
    assertSegmentCommissionUnitsValid(segmentMap[segKey]);
  }
}

/**
 * Normalize instrument tradingDefaults.additionalCharges for persistence.
 * - Forces per-line units: trade & lot = INR, crore = PERCENT.
 * - Rejects explicit wrong pairs.
 * @param {Record<string, unknown>} ch
 * @returns {Record<string, unknown>}
 */
export function sanitizeInstrumentAdditionalCharges(ch) {
  if (!ch || typeof ch !== 'object') return ch;
  const out = { ...ch };

  const coerceLineUnit = (unitKey, logicalCommissionType) => {
    const need = requiredUnitForCommissionType(logicalCommissionType);
    const v = out[unitKey];
    if (v != null && v !== '') {
      assertValidCommissionTypeUnit(logicalCommissionType, v);
    }
    out[unitKey] = need;
  };

  coerceLineUnit('perTradeUnit', 'PER_TRADE');
  coerceLineUnit('perLotUnit', 'PER_LOT');
  coerceLineUnit('perCroreUnit', 'PER_CRORE');

  return out;
}
