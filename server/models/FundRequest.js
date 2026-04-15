import mongoose from 'mongoose';

// Generate unique request ID
const generateRequestId = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `FR${timestamp}${random}`;
};

const fundRequestSchema = new mongoose.Schema({
  // Unique request ID
  requestId: {
    type: String,
    unique: true
  },
  
  // User making the request
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  
  // Admin code (for filtering)
  adminCode: {
    type: String,
    required: true,
    index: true
  },
  
  // Hierarchy path - array of all ancestor admin IDs (for hierarchical visibility)
  // Copied from user when request is created
  hierarchyPath: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }],
  
  // Request Type
  type: {
    type: String,
    enum: ['DEPOSIT', 'WITHDRAWAL'],
    required: true
  },
  
  // Amount
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  
  // Payment Method
  paymentMethod: {
    type: String,
    enum: ['BANK', 'UPI', 'CASH', 'OTHER'],
    required: true
  },
  
  // Bank account used (reference)
  bankAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BankAccount',
    default: null
  },
  
  // Transaction reference (UTR, transaction ID, etc.)
  referenceId: {
    type: String,
    default: ''
  },
  
  // Screenshot/proof URL
  proofUrl: {
    type: String,
    default: ''
  },
  
  // User remarks
  userRemarks: {
    type: String,
    default: ''
  },
  
  // Status
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'],
    default: 'PENDING'
  },
  
  // Admin action details
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  
  // For withdrawal - user's bank details
  withdrawalDetails: {
    bankName: String,
    accountNumber: String,
    ifsc: String,
    holderName: String,
    upiId: String
  }
}, { timestamps: true });

// Pre-save: Generate request ID
fundRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestId) {
    let id = generateRequestId();
    let exists = await mongoose.model('FundRequest').findOne({ requestId: id });
    while (exists) {
      id = generateRequestId();
      exists = await mongoose.model('FundRequest').findOne({ requestId: id });
    }
    this.requestId = id;
  }
  next();
});

// Index for faster queries
fundRequestSchema.index({ adminCode: 1, status: 1 });
fundRequestSchema.index({ user: 1, status: 1 });
fundRequestSchema.index({ hierarchyPath: 1, status: 1 });
fundRequestSchema.index({ createdAt: -1 });

export default mongoose.model('FundRequest', fundRequestSchema);
