import mongoose from 'mongoose';

const marketStateSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: 'GLOBAL_MARKET'
  },
  
  // Global market status
  isMarketOpen: {
    type: Boolean,
    default: false
  },
  
  // Segment-wise status
  segments: {
    EQUITY: {
      isOpen: { type: Boolean, default: false },
      dataStartTime: { type: String, default: '09:00' }, // When market data starts
      tradingStartTime: { type: String, default: '09:15' }, // When trading is allowed
      tradingEndTime: { type: String, default: '15:30' }, // When trading ends
      dataEndTime: { type: String, default: '15:30' }, // When market data ends
      intradaySquareOffTime: { type: String, default: '15:15' },
      preMarketDataOnly: { type: Boolean, default: true }, // Show data but no trading before tradingStartTime
      closedDays: { type: [Number], default: [0, 6] } // 0=Sunday, 6=Saturday - days when market is closed
    },
    FNO: {
      isOpen: { type: Boolean, default: false },
      dataStartTime: { type: String, default: '09:00' },
      tradingStartTime: { type: String, default: '09:15' },
      tradingEndTime: { type: String, default: '15:30' },
      dataEndTime: { type: String, default: '15:30' },
      intradaySquareOffTime: { type: String, default: '15:25' },
      preMarketDataOnly: { type: Boolean, default: true },
      closedDays: { type: [Number], default: [0, 6] } // 0=Sunday, 6=Saturday
    },
    MCX: {
      isOpen: { type: Boolean, default: false },
      dataStartTime: { type: String, default: '09:00' },
      tradingStartTime: { type: String, default: '09:00' },
      tradingEndTime: { type: String, default: '23:30' },
      dataEndTime: { type: String, default: '23:30' },
      intradaySquareOffTime: { type: String, default: '23:25' },
      preMarketDataOnly: { type: Boolean, default: false },
      closedDays: { type: [Number], default: [0] } // 0=Sunday - MCX closed only on Sunday
    },
    CRYPTO: {
      isOpen: { type: Boolean, default: true }, // Crypto is 24/7
      dataStartTime: { type: String, default: '00:00' },
      tradingStartTime: { type: String, default: '00:00' },
      tradingEndTime: { type: String, default: '23:59' },
      dataEndTime: { type: String, default: '23:59' },
      intradaySquareOffTime: { type: String, default: '23:59' },
      preMarketDataOnly: { type: Boolean, default: false },
      closedDays: { type: [Number], default: [] } // Crypto is 24/7, no closed days
    }
  },
  
  // Trading holidays
  holidays: [{
    date: Date,
    description: String
  }],
  
  // Manual override by Super Admin
  manualOverride: {
    type: Boolean,
    default: false
  },
  
  // Message to show when market is closed
  closedMessage: {
    type: String,
    default: 'Market is closed. Trading disabled.'
  },
  
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },
  
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
});

// Static method to get market state
marketStateSchema.statics.getState = async function() {
  let state = await this.findById('GLOBAL_MARKET');
  if (!state) {
    state = await this.create({ _id: 'GLOBAL_MARKET' });
  }
  return state;
};

// Helper to check if current time is within range (supports HH:MM and HH:MM:SS)
const isTimeInRange = (startTime, endTime) => {
  const now = new Date();
  const parts = (t) => { const p = t.split(':').map(Number); return [p[0] || 0, p[1] || 0, p[2] || 0]; };
  const [startH, startM, startS] = parts(startTime);
  const [endH, endM, endS] = parts(endTime);
  
  const currentSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const startSec = startH * 3600 + startM * 60 + startS;
  const endSec = endH * 3600 + endM * 60 + endS;
  
  return currentSec >= startSec && currentSec <= endSec;
};

// Static method to check if trading is allowed
marketStateSchema.statics.isTradingAllowed = async function(segment = 'EQUITY') {
  const state = await this.getState();
  
  // If manual override is on, use global status only
  if (state.manualOverride) {
    return { allowed: state.isMarketOpen, reason: state.isMarketOpen ? 'Market open' : 'Market closed by admin' };
  }
  
  // Check segment-specific status
  const segmentState = state.segments[segment];
  if (!segmentState) {
    return { allowed: state.isMarketOpen, reason: state.isMarketOpen ? 'Market open' : 'Market closed' };
  }
  
  // Check if segment is enabled
  if (!segmentState.isOpen) {
    return { allowed: false, reason: `${segment} segment is closed` };
  }
  
  // Note: If segment is explicitly open, we don't check global isMarketOpen
  // This allows MCX to be open even when NSE/EQUITY is closed
  
  // Check if today is a closed day for this segment
  const today = new Date().getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  const closedDays = segmentState.closedDays || [];
  if (closedDays.includes(today)) {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return { allowed: false, reason: `${segment} is closed on ${dayNames[today]}` };
  }
  
  // Check trading time window
  const tradingStart = segmentState.tradingStartTime || '09:15';
  const tradingEnd = segmentState.tradingEndTime || '15:30';
  
  if (!isTimeInRange(tradingStart, tradingEnd)) {
    // Check if we're in data-only mode (pre-market)
    const dataStart = segmentState.dataStartTime || tradingStart;
    const dataEnd = segmentState.dataEndTime || tradingEnd;
    
    if (isTimeInRange(dataStart, dataEnd)) {
      return { allowed: false, reason: 'Pre-market hours - data only, trading not allowed', dataOnly: true };
    }
    return { allowed: false, reason: `Trading hours: ${tradingStart} - ${tradingEnd}` };
  }
  
  return { allowed: true, reason: 'Trading allowed' };
};

// Static method to check if market data should be shown
marketStateSchema.statics.isDataAllowed = async function(segment = 'EQUITY') {
  const state = await this.getState();
  
  const segmentState = state.segments[segment];
  if (!segmentState) return true;
  
  const dataStart = segmentState.dataStartTime || '09:00';
  const dataEnd = segmentState.dataEndTime || '15:30';
  
  return isTimeInRange(dataStart, dataEnd);
};

// Method to update market status
marketStateSchema.statics.setMarketStatus = async function(isOpen, adminId) {
  const state = await this.getState();
  state.isMarketOpen = isOpen;
  state.manualOverride = true;
  state.lastUpdatedAt = new Date();
  state.updatedBy = adminId;
  await state.save();
  return state;
};

export default mongoose.model('MarketState', marketStateSchema);
