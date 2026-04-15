import mongoose from 'mongoose';

// TradePro Trading Engine - Risk Configuration Model
// Admin-configurable risk management settings
const riskConfigSchema = new mongoose.Schema({
  // Singleton identifier - 'global' for platform-wide, or adminCode for per-admin
  configType: {
    type: String,
    default: 'global',
    index: true
  },
  
  // Admin code (null for global config)
  adminCode: {
    type: String,
    default: null,
    index: true
  },
  
  // ==================== MARGIN LEVELS ====================
  // Margin Call Level - Warning when marginLevel drops to this %
  // User gets notification but can still trade
  MARGIN_CALL_LEVEL: {
    type: Number,
    default: 100
  },
  
  // Stop Out Level - Auto square-off when marginLevel drops to this %
  // System closes positions starting with most losing
  STOP_OUT_LEVEL: {
    type: Number,
    default: 50
  },
  
  // Healthy Level - Margin level considered safe
  HEALTHY_LEVEL: {
    type: Number,
    default: 200
  },
  
  // ==================== POSITION LIMITS ====================
  // Maximum open positions per user
  maxOpenPositions: {
    type: Number,
    default: 50
  },
  
  // Maximum order value (single order)
  maxOrderValue: {
    type: Number,
    default: 5000000 // 50 Lakhs
  },
  
  // Maximum daily turnover
  maxDailyTurnover: {
    type: Number,
    default: 50000000 // 5 Crores
  },
  
  // Maximum loss per day (triggers auto square-off)
  maxLossPerDay: {
    type: Number,
    default: 100000 // 1 Lakh
  },
  
  // Maximum leverage allowed
  maxLeverage: {
    type: Number,
    default: 20
  },
  
  // ==================== CIRCUIT BREAKER DEFAULTS ====================
  // Default circuit limit percentages by category
  circuitDefaults: {
    largeCap: { type: Number, default: 10 },
    midCap: { type: Number, default: 15 },
    smallCap: { type: Number, default: 20 },
    pennyStocks: { type: Number, default: 5 },
    mcxCommodities: { type: Number, default: 9 },
    cryptoPairs: { type: Number, default: 30 },
    ipo: { type: Number, default: 20 }
  },
  
  // ==================== EOD SETTINGS ====================
  // MIS Square-off times (minutes before market close)
  misSquareOffMinutes: {
    nse: { type: Number, default: 15 }, // 3:15 PM for NSE (15 mins before 3:30)
    mcx: { type: Number, default: 5 }   // 11:25 PM for MCX (5 mins before 11:30)
  },
  
  // Auto square-off enabled
  autoSquareOffEnabled: {
    type: Boolean,
    default: true
  },
  
  // ==================== NOTIFICATION SETTINGS ====================
  notifications: {
    marginCallSMS: { type: Boolean, default: true },
    marginCallEmail: { type: Boolean, default: true },
    marginCallPush: { type: Boolean, default: true },
    stopOutSMS: { type: Boolean, default: true },
    stopOutEmail: { type: Boolean, default: true },
    stopOutPush: { type: Boolean, default: true }
  },
  
  // ==================== NEGATIVE BALANCE PROTECTION ====================
  // Allow negative balance (if false, positions are closed before balance goes negative)
  allowNegativeBalance: {
    type: Boolean,
    default: false
  },
  
  // Auto-reset negative balance (admin approval required)
  autoResetNegativeBalance: {
    type: Boolean,
    default: false
  },
  
  // ==================== METADATA ====================
  isActive: {
    type: Boolean,
    default: true
  },
  
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index for efficient lookups
riskConfigSchema.index({ configType: 1, adminCode: 1 }, { unique: true });

// Static method to get config (admin-specific or global fallback)
riskConfigSchema.statics.getConfig = async function(adminCode = null) {
  // First try admin-specific config
  if (adminCode) {
    const adminConfig = await this.findOne({ adminCode, isActive: true });
    if (adminConfig) return adminConfig;
  }
  
  // Fall back to global config
  let globalConfig = await this.findOne({ configType: 'global', isActive: true });
  
  // Create default global config if not exists
  if (!globalConfig) {
    globalConfig = await this.create({ configType: 'global' });
  }
  
  return globalConfig;
};

// Static method to update or create config
riskConfigSchema.statics.upsertConfig = async function(adminCode, configData, updatedBy) {
  const query = adminCode 
    ? { adminCode } 
    : { configType: 'global' };
  
  const update = {
    ...configData,
    lastUpdatedBy: updatedBy,
    lastUpdatedAt: new Date()
  };
  
  if (adminCode) {
    update.adminCode = adminCode;
    update.configType = 'admin';
  } else {
    update.configType = 'global';
  }
  
  return this.findOneAndUpdate(query, update, { upsert: true, new: true });
};

export default mongoose.model('RiskConfig', riskConfigSchema);
