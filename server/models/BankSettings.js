import mongoose from 'mongoose';

const bankAccountSchema = new mongoose.Schema({
  bankName: {
    type: String,
    required: true
  },
  accountName: {
    type: String,
    required: true
  },
  accountNumber: {
    type: String,
    required: true
  },
  ifscCode: {
    type: String,
    required: true
  },
  branch: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const upiAccountSchema = new mongoose.Schema({
  upiId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  provider: {
    type: String,
    enum: ['gpay', 'phonepe', 'paytm', 'bhim', 'other'],
    default: 'other'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const bankSettingsSchema = new mongoose.Schema({
  bankAccounts: [bankAccountSchema],
  upiAccounts: [upiAccountSchema],
  minimumDeposit: {
    type: Number,
    default: 100
  },
  maximumDeposit: {
    type: Number,
    default: 1000000
  },
  minimumWithdrawal: {
    type: Number,
    default: 100
  },
  maximumWithdrawal: {
    type: Number,
    default: 500000
  },
  withdrawalProcessingTime: {
    type: String,
    default: '24-48 hours'
  },
  depositInstructions: {
    type: String,
    default: 'Transfer funds to the bank account or UPI ID shown above. After payment, enter the UTR/Transaction ID to verify your deposit.'
  },
  withdrawalInstructions: {
    type: String,
    default: 'Enter the amount you wish to withdraw and your bank account details. Withdrawals are processed within 24-48 hours.'
  }
}, { timestamps: true });

// Ensure only one settings document exists
bankSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      bankAccounts: [{
        bankName: 'HDFC Bank',
        accountName: 'stockex Payments Pvt Ltd',
        accountNumber: '50100123456789',
        ifscCode: 'HDFC0001234',
        branch: 'Mumbai Main Branch',
        isActive: true,
        isPrimary: true
      }],
      upiAccounts: [{
        upiId: 'stockex@hdfcbank',
        name: 'stockex Payments',
        provider: 'other',
        isActive: true,
        isPrimary: true
      }]
    });
  }
  return settings;
};

const BankSettings = mongoose.model('BankSettings', bankSettingsSchema);

export default BankSettings;
