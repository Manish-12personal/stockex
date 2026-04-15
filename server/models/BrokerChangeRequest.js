import mongoose from 'mongoose';

const brokerChangeRequestSchema = new mongoose.Schema({
  // User requesting the change
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  
  // Current admin/broker details
  currentAdminCode: {
    type: String,
    required: true
  },
  currentAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Requested new admin/broker details
  requestedAdminCode: {
    type: String,
    required: true
  },
  requestedAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  
  // Request details
  reason: {
    type: String,
    default: ''
  },
  
  // Status
  status: {
    type: String,
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    default: 'PENDING'
  },
  
  // Parent admin who should approve (ADMIN role or SUPER_ADMIN)
  parentAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  // Processing details
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  processedAt: {
    type: Date
  },
  adminRemarks: {
    type: String,
    default: ''
  },
  
  // Request ID for display
  requestId: {
    type: String,
    unique: true
  }
}, {
  timestamps: true
});

// Generate unique request ID before saving
brokerChangeRequestSchema.pre('save', async function(next) {
  if (this.isNew && !this.requestId) {
    const randomStr = Math.random().toString(36).substring(2, 10).toUpperCase();
    this.requestId = `BCR${randomStr}`;
  }
  next();
});

// Index for faster queries
brokerChangeRequestSchema.index({ user: 1, status: 1 });
brokerChangeRequestSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('BrokerChangeRequest', brokerChangeRequestSchema);
