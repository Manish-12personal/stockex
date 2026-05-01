/** Compare segment slice field values (handles nested optionBuy / optionSell). */
export function segmentFieldValuesEqual(a, b) {
  if (a === b) return true;
  if (a != null && typeof a === 'object' && b != null && typeof b === 'object') {
    try {
      return JSON.stringify(a) === JSON.stringify(b);
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Per segment, top-level keys whose values differ from Super Admin `adminSegmentDefaults`.
 */
export function computeSegmentExplicitKeys(segDefs, systemDefaultsPlain) {
  const sys = systemDefaultsPlain || {};
  const out = {};
  for (const seg of Object.keys(segDefs || {})) {
    const cur = segDefs[seg] || {};
    const defSeg = sys[seg] || {};
    const keys = [];
    for (const k of Object.keys(cur)) {
      if (!segmentFieldValuesEqual(cur[k], defSeg[k])) keys.push(k);
    }
    out[seg] = keys;
  }
  return out;
}
