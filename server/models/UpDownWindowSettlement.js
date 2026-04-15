import mongoose from 'mongoose';

/** Prevents double-crediting the same user/game/window/day if resolve is retried (window # repeats daily). */
const upDownWindowSettlementSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: String, required: true },
    windowNumber: { type: Number, required: true },
    /** YYYY-MM-DD (IST) — trading session day for this window */
    settlementDay: { type: String, required: true },
  },
  { timestamps: true }
);

upDownWindowSettlementSchema.index(
  { user: 1, gameId: 1, windowNumber: 1, settlementDay: 1 },
  { unique: true }
);

export default mongoose.model('UpDownWindowSettlement', upDownWindowSettlementSchema);
