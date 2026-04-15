import mongoose from 'mongoose';

const gameTransactionSlipSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  userCode: {
    type: String,
    required: true,
    index: true
  },
  adminCode: {
    type: String,
    required: true,
    index: true
  },
  gameIds: [{
    type: String,
    enum: ['updown', 'btcupdown', 'niftyNumber', 'niftyBracket', 'niftyJackpot']
  }],
  totalDebitAmount: {
    type: Number,
    required: true,
    default: 0
  },
  totalCreditAmount: {
    type: Number,
    default: 0
  },
  netPnL: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['PENDING', 'PARTIALLY_SETTLED', 'FULLY_SETTLED'],
    default: 'PENDING',
    index: true
  },
  settledAt: {
    type: Date,
    default: null
  },
  metadata: {
    totalBets: { type: Number, default: 0 },
    settledBets: { type: Number, default: 0 },
    sessionDate: { type: String }, // YYYY-MM-DD format
    placementTime: { type: String }, // HH:MM:SS IST format
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
gameTransactionSlipSchema.index({ userId: 1, createdAt: -1 });
gameTransactionSlipSchema.index({ adminCode: 1, createdAt: -1 });
gameTransactionSlipSchema.index({ status: 1, createdAt: -1 });
gameTransactionSlipSchema.index({ 'metadata.sessionDate': 1, createdAt: -1 });

// Update netPnL whenever amounts change
gameTransactionSlipSchema.pre('save', function() {
  this.netPnL = this.totalCreditAmount - this.totalDebitAmount;
  
  // Update status based on settlement progress
  if (this.metadata.settledBets === 0) {
    this.status = 'PENDING';
  } else if (this.metadata.settledBets < this.metadata.totalBets) {
    this.status = 'PARTIALLY_SETTLED';
  } else {
    this.status = 'FULLY_SETTLED';
    if (!this.settledAt) {
      this.settledAt = new Date();
    }
  }
});

export default mongoose.model('GameTransactionSlip', gameTransactionSlipSchema);
