import mongoose from 'mongoose';
import { getTodayISTString, startOfISTDayFromKey, endOfISTDayFromKey } from '../utils/istDate.js';

const gameResultSchema = new mongoose.Schema({
  gameId: {
    type: String,
    enum: ['updown', 'btcupdown'],
    required: true,
    index: true
  },
  windowNumber: {
    type: Number,
    required: true
  },
  windowDate: {
    type: Date,
    required: true,
    index: true
  },
  openPrice: {
    type: Number,
    required: true
  },
  closePrice: {
    type: Number,
    required: true
  },
  result: {
    type: String,
    enum: ['UP', 'DOWN', 'TIE'],
    required: true
  },
  priceChange: {
    type: Number,
    default: 0
  },
  priceChangePercent: {
    type: Number,
    default: 0
  },
  totalBets: {
    type: Number,
    default: 0
  },
  totalUpBets: {
    type: Number,
    default: 0
  },
  totalDownBets: {
    type: Number,
    default: 0
  },
  totalVolume: {
    type: Number,
    default: 0
  },
  windowStartTime: {
    type: String
  },
  windowEndTime: {
    type: String
  },
  resultTime: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Compound index for efficient queries
gameResultSchema.index({ gameId: 1, windowDate: -1, windowNumber: -1 });

// Static method to get recent results
gameResultSchema.statics.getRecentResults = async function(gameId, limit = 20) {
  return this.find({ gameId })
    .sort({ windowDate: -1, windowNumber: -1 })
    .limit(limit)
    .lean();
};

// Static method to get today's results (IST calendar day)
gameResultSchema.statics.getTodayResults = async function(gameId) {
  const key = getTodayISTString();
  const start = startOfISTDayFromKey(key);
  const end = endOfISTDayFromKey(key);
  if (!start || !end) return [];
  
  console.log(`[GameResult] Fetching ${gameId} results for ${key} (${start} to ${end})`);
  
  const results = await this.find({
    gameId,
    windowDate: { $gte: start, $lt: end },
  })
    .sort({ windowNumber: -1 })
    .lean();
    
  console.log(`[GameResult] Found ${results.length} results for ${gameId} today`);
  
  return results;
};

// Static method to get recent results with fallback to previous days
gameResultSchema.statics.getRecentResultsWithFallback = async function(gameId, limit = 20) {
  const today = getTodayISTString();
  const todayStart = startOfISTDayFromKey(today);
  const todayEnd = endOfISTDayFromKey(today);
  
  // Try today's results first
  if (todayStart && todayEnd) {
    const todayResults = await this.find({
      gameId,
      windowDate: { $gte: todayStart, $lt: todayEnd },
    })
      .sort({ windowNumber: -1 })
      .limit(limit)
      .lean();
      
    if (todayResults.length > 0) {
      console.log(`[GameResult] Found ${todayResults.length} results for ${gameId} from today`);
      return todayResults;
    }
  }
  
  // Fallback to previous days if no results today
  console.log(`[GameResult] No results for ${gameId} today, checking previous days...`);
  
  const previousResults = await this.find({ gameId })
    .sort({ windowDate: -1, windowNumber: -1 })
    .limit(limit)
    .lean();
    
  console.log(`[GameResult] Found ${previousResults.length} results for ${gameId} from previous days`);
  
  return previousResults;
};

const GameResult = mongoose.model('GameResult', gameResultSchema);

export default GameResult;
