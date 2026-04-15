import { sanitizeInstrumentAdditionalCharges } from '../utils/commissionTypeUnit.js';

/**
 * Mutates req.body.tradingDefaults.additionalCharges so only valid per-line units are persisted.
 */
export function sanitizeInstrumentTradingDefaultsCommission(req, res, next) {
  try {
    const td = req.body?.tradingDefaults;
    if (td?.additionalCharges && typeof td.additionalCharges === 'object') {
      req.body.tradingDefaults = {
        ...td,
        additionalCharges: sanitizeInstrumentAdditionalCharges(td.additionalCharges),
      };
    }
    next();
  } catch (err) {
    const status = err.name === 'CommissionTypeUnitError' ? 400 : 400;
    return res.status(status).json({ message: err.message || 'Invalid commission unit configuration' });
  }
}
