import mongoose from 'mongoose';

const niftyJackpotResultSchema = new mongoose.Schema({
  // Date for which this result applies (YYYY-MM-DD)
  resultDate: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  // Locked Nifty price at result time
  lockedPrice: {
    type: Number,
    required: true
  },
  // Time when price was locked
  lockedAt: {
    type: Date,
    default: Date.now
  },
  // Who locked it (admin ID)
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Whether result has been declared for this date
  resultDeclared: {
    type: Boolean,
    default: false
  },
  resultDeclaredAt: {
    type: Date,
    default: null
  },
  // Total number of bids for this date
  totalBids: {
    type: Number,
    default: 0
  },
  // Total prize amount distributed
  totalPrizeDistributed: {
    type: Number,
    default: 0
  },
  // Number of winners
  totalWinners: {
    type: Number,
    default: 0
  },
  // Winning numbers (if applicable)
  winningNumbers: [{
    type: Number
  }],
  // Prize distribution details
  prizeDistribution: [{
    rank: Number,
    bidId: mongoose.Schema.Types.ObjectId,
    userId: mongoose.Schema.Types.ObjectId,
    prize: Number,
    winningNumber: Number
  }]
}, {
  timestamps: true
});

// Compound index for efficient queries
niftyJackpotResultSchema.index({ resultDate: 1, resultDeclared: 1 });
niftyJackpotResultSchema.index({ resultDeclared: 1, createdAt: -1 });

const NiftyJackpotResult = mongoose.model('NiftyJackpotResult', niftyJackpotResultSchema);

export default NiftyJackpotResult;
