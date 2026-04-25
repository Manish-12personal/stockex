import mongoose from 'mongoose';

/**
 * BTC Jackpot "Bank" — per your spec (point 4): every placed ticket adds to this wallet
 * for that IST day, and winners' prizes are paid out of it at result time (23:30 IST).
 * This is purely a ledger/stats row — the actual cash movement happens via the Super Admin wallet
 * (credited at bid time, debited at declare time) in `btcJackpotPool.js`.
 */
const btcJackpotBankSchema = new mongoose.Schema(
  {
    betDate: { type: String, required: true, unique: true, index: true },
    totalStake: { type: Number, default: 0 },
    totalPaidOut: { type: Number, default: 0 },
    totalHierarchyPaid: { type: Number, default: 0 },
    bidsCount: { type: Number, default: 0 },
    lockedBtcPrice: { type: Number, default: null },
    lockedAt: { type: Date, default: null },
    resultDeclared: { type: Boolean, default: false },
    resultDeclaredAt: { type: Date, default: null },
    winners: [
      {
        bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'BtcJackpotBid' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        rank: Number,
        prize: Number,
        predictedBtc: Number,
      },
    ],
  },
  { timestamps: true }
);

const BtcJackpotBank = mongoose.model('BtcJackpotBank', btcJackpotBankSchema);
export default BtcJackpotBank;
