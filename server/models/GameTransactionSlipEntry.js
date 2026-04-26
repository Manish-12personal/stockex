import mongoose from 'mongoose';

const gameTransactionSlipEntrySchema = new mongoose.Schema({
  transactionSlipId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GameTransactionSlip',
    required: true,
    index: true
  },
  transactionId: {
    type: String,
    required: true,
    index: true
  },
  entryType: {
    type: String,
    enum: ['DEBIT', 'CREDIT', 'BROKERAGE_DISTRIBUTION'],
    required: true,
    index: true
  },
  gameId: {
    type: String,
    enum: ['updown', 'btcupdown', 'niftyNumber', 'niftyBracket', 'niftyJackpot', 'btcNumber', 'btcJackpot'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  recipientType: {
    type: String,
    enum: ['USER', 'SUB_BROKER', 'BROKER', 'ADMIN', 'SUPER_ADMIN'],
    required: true,
    index: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  recipientCode: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  metadata: {
    // For DEBIT entries (bet placement)
    prediction: { type: String, enum: ['UP', 'DOWN'] },
    windowNumber: { type: Number },
    entryPrice: { type: Number },
    tickets: { type: Number },
    tokenValue: { type: Number },
    settlementDay: { type: String },
    
    // For CREDIT entries (winnings)
    won: { type: Boolean },
    pnl: { type: Number },
    brokerage: { type: Number },
    grossWin: { type: Number },
    openPrice: { type: Number },
    closePrice: { type: Number },
    resultTime: { type: String },
    
    // For BROKERAGE_DISTRIBUTION entries
    sharePercent: { type: Number },
    baseAmount: { type: Number },
    distributionType: { type: String, enum: ['WIN_BROKERAGE', 'LOSS_PROFIT'] },
    hierarchyLevel: { type: String },
    
    // Common fields
    gameLabel: { type: String },
    timestamp: { type: Date, default: Date.now },
    relatedLedgerId: { type: mongoose.Schema.Types.ObjectId }, // Link to GamesWalletLedger or WalletLedger
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
gameTransactionSlipEntrySchema.index({ transactionSlipId: 1, createdAt: 1 });
gameTransactionSlipEntrySchema.index({ transactionId: 1, entryType: 1 });
gameTransactionSlipEntrySchema.index({ recipientId: 1, recipientType: 1, createdAt: -1 });
gameTransactionSlipEntrySchema.index({ gameId: 1, entryType: 1, createdAt: -1 });
gameTransactionSlipEntrySchema.index({ 'metadata.windowNumber': 1, gameId: 1 });

export default mongoose.model('GameTransactionSlipEntry', gameTransactionSlipEntrySchema);
