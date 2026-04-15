import mongoose from 'mongoose';

const niftyBracketTradeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  // Trade details
  entryPrice: {
    type: Number,
    required: true
  },
  upperTarget: {
    type: Number,
    required: true
  },
  lowerTarget: {
    type: Number,
    required: true
  },
  bracketGap: {
    type: Number,
    required: true
  },
  prediction: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  // Result
  status: {
    type: String,
    enum: ['active', 'won', 'lost', 'expired', 'cancelled'],
    default: 'active'
  },
  exitPrice: {
    type: Number,
    default: null
  },
  profit: {
    type: Number,
    default: 0
  },
  winMultiplier: {
    type: Number,
    default: 2
  },
  brokeragePercent: {
    type: Number,
    default: 5
  },
  brokerageAmount: {
    type: Number,
    default: 0
  },
  // Timing
  expiresAt: {
    type: Date,
    required: true
  },
  /** When true, win/loss is decided only at expiresAt (result time IST), not on earlier LTP touches. */
  settlesAtSessionClose: {
    type: Boolean,
    default: false
  },
  resolvedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for finding active trades quickly
niftyBracketTradeSchema.index({ user: 1, status: 1 });
niftyBracketTradeSchema.index({ status: 1, expiresAt: 1 });

const NiftyBracketTrade = mongoose.model('NiftyBracketTrade', niftyBracketTradeSchema);

export default NiftyBracketTrade;
