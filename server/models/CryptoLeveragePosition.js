import mongoose from 'mongoose';

/**
 * Open / closed crypto leverage position (per symbol, LONG or SHORT).
 * Notional at price P: abs(quantity) × P (quantity is base-asset size).
 */
const cryptoLeveragePositionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CryptoLeverageUser',
      required: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    side: {
      type: String,
      enum: ['LONG', 'SHORT'],
      required: true,
    },
    /** Base-asset quantity (> 0); SHORT still stored as positive magnitude */
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    entryPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['OPEN', 'CLOSED'],
      default: 'OPEN',
      index: true,
    },
    /** Reason for last automated action (EOD / risk) */
    lastActionReason: {
      type: String,
      enum: ['NONE', 'EOD_SQUARE_OFF', 'MARGIN_LIQUIDATION', 'MANUAL', null],
      default: 'NONE',
    },
  },
  { timestamps: true }
);

cryptoLeveragePositionSchema.index({ user: 1, symbol: 1, status: 1 });

/**
 * Mark-to-market notional at `ltp`.
 */
cryptoLeveragePositionSchema.methods.notionalAt = function notionalAt(ltp) {
  const q = Number(this.quantity);
  const p = Number(ltp);
  if (!Number.isFinite(q) || !Number.isFinite(p) || q < 0 || p < 0) return 0;
  return q * p;
};

export default mongoose.model('CryptoLeveragePosition', cryptoLeveragePositionSchema);
