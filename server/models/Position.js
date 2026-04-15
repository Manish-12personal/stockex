import mongoose from 'mongoose';

const positionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true
  },
  exchange: {
    type: String,
    enum: ['NSE', 'BSE', 'MCX'],
    required: true
  },
  segment: {
    type: String,
    enum: ['equity', 'futures', 'options'],
    required: true
  },
  optionType: {
    type: String,
    enum: ['CE', 'PE', null],
    default: null
  },
  strikePrice: {
    type: Number,
    default: null
  },
  expiry: {
    type: Date,
    default: null
  },
  productType: {
    type: String,
    enum: ['CNC', 'MIS', 'NRML'],
    required: true
  },
  side: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  lotSize: {
    type: Number,
    default: 1
  },
  entryPrice: {
    type: Number,
    required: true
  },
  currentPrice: {
    type: Number,
    default: 0
  },
  marginUsed: {
    type: Number,
    default: 0
  },
  unrealizedPnL: {
    type: Number,
    default: 0
  },
  realizedPnL: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED', 'SQUARED_OFF'],
    default: 'OPEN'
  },
  squareOffReason: {
    type: String,
    enum: ['MANUAL', 'TIME_BASED', 'RMS', 'EXPIRY', 'MTM_LOSS', null],
    default: null
  },
  squareOffTime: {
    type: Date,
    default: null
  },
  exitPrice: {
    type: Number,
    default: null
  }
}, { timestamps: true });

// Calculate unrealized P&L
positionSchema.methods.calculateUnrealizedPnL = function() {
  const multiplier = this.side === 'BUY' ? 1 : -1;
  const priceDiff = (this.currentPrice - this.entryPrice) * multiplier;
  this.unrealizedPnL = priceDiff * this.quantity * this.lotSize;
  return this.unrealizedPnL;
};

// Calculate realized P&L on close
positionSchema.methods.calculateRealizedPnL = function(exitPrice) {
  const multiplier = this.side === 'BUY' ? 1 : -1;
  const priceDiff = (exitPrice - this.entryPrice) * multiplier;
  this.realizedPnL = priceDiff * this.quantity * this.lotSize;
  this.exitPrice = exitPrice;
  return this.realizedPnL;
};

// Index for faster queries
positionSchema.index({ user: 1, status: 1 });
positionSchema.index({ user: 1, symbol: 1, status: 1 });

export default mongoose.model('Position', positionSchema);
