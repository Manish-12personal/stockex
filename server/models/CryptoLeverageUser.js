import mongoose from 'mongoose';

/**
 * Standalone crypto margin account for leverage trading.
 * Keeps wallet + leverage knobs separate from the main User document to avoid
 * coupling this module to the large production user schema.
 * Optional `mainUser` links to the platform User when both exist.
 */
const cryptoLeverageUserSchema = new mongoose.Schema(
  {
    /** Optional link to primary app User */
    mainUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
      unique: true,
      index: true,
    },
    /** Free cash / margin wallet (same currency unit as prices, e.g. USDT) */
    walletBalance: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    /** Max intraday notional multiple (e.g. 10 → limit = balance × 10) */
    intradayLeverage: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    /** Max overnight notional multiple after auto square-off (e.g. 2) */
    carryForwardLeverage: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  { timestamps: true }
);

/**
 * Intraday notional cap: wallet × intraday leverage.
 */
cryptoLeverageUserSchema.methods.getIntradayLimit = function getIntradayLimit() {
  return this.walletBalance * this.intradayLeverage;
};

/**
 * Overnight notional cap per risk rules: wallet × carry-forward leverage.
 */
cryptoLeverageUserSchema.methods.getCarryForwardLimit = function getCarryForwardLimit() {
  return this.walletBalance * this.carryForwardLeverage;
};

export default mongoose.model('CryptoLeverageUser', cryptoLeverageUserSchema);
