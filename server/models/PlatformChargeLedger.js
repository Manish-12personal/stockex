import mongoose from 'mongoose';

const platformChargeLedgerSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    chargeDayKey: {
      type: String,
      required: true,
      trim: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['CHARGED', 'FAILED'],
      required: true,
    },
    failureReason: {
      type: String,
      default: '',
      trim: true,
    },
    superAdminAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
    },
  },
  { timestamps: true }
);

platformChargeLedgerSchema.index({ chargeDayKey: 1, status: 1 });
platformChargeLedgerSchema.index({ user: 1, chargeDayKey: 1 }, { unique: true });

export default mongoose.model('PlatformChargeLedger', platformChargeLedgerSchema);
