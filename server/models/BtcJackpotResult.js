import mongoose from 'mongoose';

/**
 * BTC Jackpot — daily result anchor. `lockedBtcPrice` is the BTC/USDT spot when locked
 * (auto after bidding ends, at BTC Number result time when both games run, or manual).
 */
const btcJackpotResultSchema = new mongoose.Schema(
  {
    resultDate: { type: String, required: true, unique: true, index: true },
    lockedBtcPrice: { type: Number, required: true },
    lockedAt: { type: Date, default: Date.now },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
    lockedSource: {
      type: String,
      enum: ['binance_ws', 'binance_rest', 'manual'],
      default: 'binance_rest',
    },

    resultDeclared: { type: Boolean, default: false },
    resultDeclaredAt: { type: Date, default: null },

    totalBids: { type: Number, default: 0 },
    totalPool: { type: Number, default: 0 },
    totalWinners: { type: Number, default: 0 },
    totalPaidOut: { type: Number, default: 0 },
    totalHierarchyPaid: { type: Number, default: 0 },

    prizeDistribution: [
      {
        rank: Number,
        bidId: { type: mongoose.Schema.Types.ObjectId, ref: 'BtcJackpotBid' },
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        prize: Number,
        predictedBtc: Number,
        tiedWith: Number,
      },
    ],
  },
  { timestamps: true }
);

btcJackpotResultSchema.index({ resultDate: 1, resultDeclared: 1 });

const BtcJackpotResult = mongoose.model('BtcJackpotResult', btcJackpotResultSchema);
export default BtcJackpotResult;
