import mongoose from 'mongoose';

const gamesWalletLedgerSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    gameId: { type: String, default: '' },
    gameLabel: { type: String, default: '' },
    entryType: { type: String, enum: ['debit', 'credit'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    description: { type: String, default: '' },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

gamesWalletLedgerSchema.index({ user: 1, createdAt: -1 });
gamesWalletLedgerSchema.index({ user: 1, gameId: 1, createdAt: -1 });

export default mongoose.model('GamesWalletLedger', gamesWalletLedgerSchema);
