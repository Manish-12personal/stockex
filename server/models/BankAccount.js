import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  // Admin who owns this bank account
  adminCode: {
    type: String,
    required: true,
    index: true
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  // Account Type
  type: {
    type: String,
    enum: ['BANK', 'UPI'],
    required: true
  },
  
  // Bank Details (for BANK type)
  holderName: {
    type: String,
    required: true
  },
  bankName: {
    type: String,
    default: ''
  },
  accountNumber: {
    type: String,
    default: ''
  },
  ifsc: {
    type: String,
    default: ''
  },
  accountType: {
    type: String,
    enum: ['SAVINGS', 'CURRENT', ''],
    default: ''
  },
  
  // UPI Details (for UPI type)
  upiId: {
    type: String,
    default: ''
  },
  
  // QR Code image URL (optional)
  qrCodeUrl: {
    type: String,
    default: ''
  },
  
  // Status
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Index for faster queries
bankAccountSchema.index({ adminCode: 1, isActive: 1 });
bankAccountSchema.index({ adminCode: 1, type: 1 });

export default mongoose.model('BankAccount', bankAccountSchema);
