import mongoose from 'mongoose';

/**
 * Ledger of opens, partial closes, EOD square-offs, and liquidations.
 */
const cryptoLeverageTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CryptoLeverageUser',
      required: true,
      index: true,
    },
    position: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CryptoLeveragePosition',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['OPEN', 'PARTIAL_CLOSE', 'EOD_SQUARE_OFF', 'LIQUIDATION', 'FULL_CLOSE'],
      required: true,
    },
    /** Signed base quantity: positive = buy, negative = sell (for SHORT reduction, buy-back is positive qty) */
    quantityDelta: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    notional: {
      type: Number,
      required: true,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

cryptoLeverageTransactionSchema.index({ user: 1, createdAt: -1 });

export default mongoose.model('CryptoLeverageTransaction', cryptoLeverageTransactionSchema);
