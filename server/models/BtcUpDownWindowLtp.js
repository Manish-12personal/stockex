import mongoose from 'mongoose';

const btcUpDownWindowLtpSchema = new mongoose.Schema(
  {
    istDayKey: { type: String, required: true, index: true },
    windowNumber: { type: Number, required: true },
    price: { type: Number, required: true },
    sampledAt: { type: Date, default: Date.now },
    source: { type: String, enum: ['live', 'binance', 'ledger_min'], default: 'live' },
  },
  { timestamps: true }
);

btcUpDownWindowLtpSchema.index({ istDayKey: 1, windowNumber: 1 }, { unique: true });

const BtcUpDownWindowLtp = mongoose.model('BtcUpDownWindowLtp', btcUpDownWindowLtpSchema);

export default BtcUpDownWindowLtp;
