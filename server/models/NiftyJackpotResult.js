import mongoose from 'mongoose';

const niftyJackpotResultSchema = new mongoose.Schema({
  // Date for which this result applies (YYYY-MM-DD)
  resultDate: {
    type: String,
    required: true,
    unique: true
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
  }
}, {
  timestamps: true
});

const NiftyJackpotResult = mongoose.model('NiftyJackpotResult', niftyJackpotResultSchema);

export default NiftyJackpotResult;
