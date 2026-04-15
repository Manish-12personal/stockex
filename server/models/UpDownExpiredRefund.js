import mongoose from 'mongoose';

/** User received stake back because Up/Down window was not settled before removal deadline — blocks later settle for same window/day. */
const upDownExpiredRefundSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    gameId: { type: String, required: true },
    windowNumber: { type: Number, required: true },
    settlementDay: { type: String, required: true },
  },
  { timestamps: true }
);

upDownExpiredRefundSchema.index(
  { user: 1, gameId: 1, windowNumber: 1, settlementDay: 1 },
  { unique: true }
);

export default mongoose.model('UpDownExpiredRefund', upDownExpiredRefundSchema);
