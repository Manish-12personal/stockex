import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { Server } from 'socket.io';
import connectDB from './config/db.js';
import adminRoutes from './routes/adminRoutes.js';
import userRoutes from './routes/userRoutes.js';
import tradingRoutes from './routes/tradingRoutes.js';
import adminManagementRoutes from './routes/adminManagementRoutes.js';
import userFundRoutes from './routes/userFundRoutes.js';
import tradeRoutes, { setTradeSocketIO } from './routes/tradeRoutes.js';
import instrumentRoutes from './routes/instrumentRoutes.js';
import binanceRoutes from './routes/binanceRoutes.js';
import zerodhaRoutes, { setSocketIO, restoreZerodhaTickerIfNeeded } from './routes/zerodhaRoutes.js';
import { initZerodhaWebSocket, getTickerStatus } from './services/zerodhaWebSocket.js';
import { initBinanceWebSocket } from './services/binanceWebSocket.js';
import { initForexMarketService } from './services/forexMarketService.js';
import forexRoutes from './routes/forexRoutes.js';
import uploadRoutes from './routes/uploadRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import exchangeRateRoutes from './routes/exchangeRateRoutes.js';
import marketDataRoutes from './routes/marketDataRoutes.js';
import adminTransactionSlipRoutes from './routes/adminTransactionSlipRoutes.js';
import cryptoLeverageRoutes from './routes/cryptoLeverageRoutes.js';
import User from './models/User.js';
import Trade from './models/Trade.js';
import MarketState from './models/MarketState.js';
import TradingService from './services/tradingService.js';
import { runGamesAutoSettlementTick } from './services/gamesAutoSettlement.js';
import { runInstrumentAvailabilityTicks } from './services/instrumentAvailabilityJobs.js';
import { startInstrumentExpiryMonitoring } from './services/instrumentExpiryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load server/.env (PM2 cwd is often repo root — default dotenv cwd breaks MONGODB_URI)
dotenv.config({ path: path.join(__dirname, '.env') });

/** CORS + Socket.IO: merge CLIENT_URL, comma-separated CORS_ORIGIN, and local dev defaults */
function buildAllowedOrigins() {
  const list = [];
  const add = (u) => {
    if (u == null || u === '') return;
    const t = String(u).trim().replace(/\/$/, '');
    if (t && !list.includes(t)) list.push(t);
  };
  add(process.env.CLIENT_URL);
  if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN.split(',').forEach((o) => add(o));
  }
  add('http://localhost:3000');
  add('http://localhost:5173');
  return list;
}
const allowedOrigins = buildAllowedOrigins();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Initialize Zerodha WebSocket service with Socket.IO
initZerodhaWebSocket(io);
setSocketIO(io);
setTradeSocketIO(io);

// Initialize Binance WebSocket for real-time crypto data
initBinanceWebSocket(io);
// Synthetic forex quotes (USD base API → pairs, INR wallet on trade side)
initForexMarketService(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('get_zerodha_status', () => {
    const status = getTickerStatus();
    socket.emit('zerodha_status', { connected: status.connected });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Middleware - CORS for production
app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));
// Bump body limits to handle larger admin create-user payloads
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/admin/manage', adminManagementRoutes);
app.use('/api/user', userRoutes);
app.use('/api/user/funds', userFundRoutes);
app.use('/api/trading', tradingRoutes);
app.use('/api/trade', tradeRoutes);
app.use('/api/instruments', instrumentRoutes);
app.use('/api/binance', binanceRoutes);
app.use('/api/forex', forexRoutes);
app.use('/api/zerodha', zerodhaRoutes);
app.use('/auth/zerodha', zerodhaRoutes); // Alias for Kite Connect redirect URL
app.use('/api/upload', uploadRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/exchange-rate', exchangeRateRoutes);
app.use('/api/market', marketDataRoutes);
app.use('/api/admin', adminTransactionSlipRoutes);
app.use('/api/crypto-leverage', cryptoLeverageRoutes);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
  const stateMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbState = mongoose.connection.readyState;

  res.json({ 
    status: 'ok', 
    message: 'stockex API is running',
    database: {
      connected: dbState === 1,
      state: stateMap[dbState] || 'unknown',
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null
    }
  });
});

const PORT = process.env.PORT || 5001;

(async () => {
  console.log(
    `[stockex-api] Boot cwd=${process.cwd()} PORT=${PORT} env=${path.join(__dirname, '.env')}`
  );
  try {
    await connectDB();
  } catch (err) {
    console.error('MongoDB connection failed — API will not start.');
    console.error(err.message);
    console.error('Fix: start MongoDB (mongod / Windows service) and check MONGODB_URI in server/.env');
    process.exit(1);
  }

  await restoreZerodhaTickerIfNeeded();

  console.log(`[stockex-api] Binding HTTP 0.0.0.0:${PORT}...`);

  httpServer.on('error', (err) => {
    console.error('HTTP server failed to start:', err.message);
    process.exit(1);
  });

  // Bind IPv4 explicitly so nginx upstream 127.0.0.1 always matches (avoids localhost IPv6-only mismatches).
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on 0.0.0.0:${PORT}`);
    // Run only after DB is ready (avoids Mongoose buffer timeout on startup)
    cleanupExpiredDemoAccounts();
    runGamesAutoSettlementTick().catch((e) => console.warn('[gamesAutoSettlement]', e?.message || e));
    // Start instrument expiry monitoring
    startInstrumentExpiryMonitoring();
    // Bracket / Up-Down / Jackpot / Nifty Number auto-credits. Off if GAMES_AUTO_SETTLEMENT=false
    setInterval(() => {
      runGamesAutoSettlementTick().catch((e) => console.warn('[gamesAutoSettlement]', e?.message || e));
    }, 60 * 1000);
  });
})().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

// Auto convert intraday (MIS) positions to carry forward (NRML) at market close
// Instead of square-off, we convert to carry forward with leverage adjustment
const runIntradayToCarryForward = async () => {
  try {
    const now = new Date();
    const istTime = now.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // Get market state to check conversion times (using intradaySquareOffTime)
    const marketState = await MarketState.getState();
    
    const segments = ['EQUITY', 'FNO', 'MCX'];
    
    for (const segment of segments) {
      const segmentState = marketState.segments[segment];
      if (!segmentState || !segmentState.isOpen) continue;
      
      const conversionTime = segmentState.intradaySquareOffTime || '15:15';
      
      // Check if current time matches conversion time (within 1 minute window)
      if (istTime === conversionTime || istTime === conversionTime.replace(':', '')) {
        console.log(`Running intraday to carry forward conversion for ${segment} at ${istTime}`);
        
        // Find all open MIS trades for this segment
        const openMISTrades = await Trade.find({
          status: 'OPEN',
          productType: 'MIS',
          $or: [
            { segment: segment },
            { segment: segment === 'FNO' ? { $in: ['NSEFUT', 'NSEOPT', 'NFO'] } : segment },
            { segment: segment === 'EQUITY' ? { $in: ['NSE-EQ', 'EQUITY', 'NSE'] } : segment }
          ]
        }).populate('user');
        
        let convertedCount = 0;
        let partialCount = 0;
        let closedCount = 0;
        
        for (const trade of openMISTrades) {
          try {
            // Import TradeService for conversion
            const TradeService = (await import('./services/tradeService.js')).default;
            const result = await TradeService.convertIntradayToCarryForward(trade);
            
            if (result.fullyConverted) {
              convertedCount++;
              console.log(`Converted to carry forward: ${trade.symbol} for user ${trade.user?.userId || trade.user}`);
            } else if (result.action === 'PARTIAL_CONVERSION') {
              partialCount++;
              console.log(`Partially converted: ${trade.symbol} - ${result.keptLots} lots kept, ${result.closedLots} lots closed`);
            } else if (result.action === 'CLOSED') {
              closedCount++;
              console.log(`Closed (insufficient margin): ${trade.symbol} for user ${trade.user?.userId || trade.user}`);
            }
          } catch (err) {
            console.error(`Error converting trade ${trade._id}:`, err.message);
          }
        }
        
        if (convertedCount > 0 || partialCount > 0 || closedCount > 0) {
          console.log(`Intraday conversion completed for ${segment}: ${convertedCount} fully converted, ${partialCount} partially converted, ${closedCount} closed`);
        }
      }
    }
  } catch (error) {
    console.error('Error in intraday to carry forward conversion:', error);
  }
};

// Run intraday conversion check every minute
setInterval(runIntradayToCarryForward, 60 * 1000);

// Client temp closes + Super Admin scheduled re-opens
setInterval(() => {
  runInstrumentAvailabilityTicks().catch((err) =>
    console.error('[instruments] runInstrumentAvailabilityTicks:', err.message)
  );
}, 60 * 1000);

// Cleanup expired demo accounts - runs every hour
const cleanupExpiredDemoAccounts = async () => {
  try {
    const now = new Date();
    const expiredUsers = await User.find({
      isDemo: true,
      demoExpiresAt: { $lt: now }
    });
    
    if (expiredUsers.length > 0) {
      // Import models for cleanup
      const Position = (await import('./models/Position.js')).default;
      const Order = (await import('./models/Order.js')).default;
      const Trade = (await import('./models/Trade.js')).default;
      
      for (const user of expiredUsers) {
        // Delete user's trading data
        await Position.deleteMany({ user: user._id });
        await Order.deleteMany({ user: user._id });
        await Trade.deleteMany({ user: user._id });
        
        // Delete the user
        await User.deleteOne({ _id: user._id });
        console.log(`Deleted expired demo account: ${user.username} (${user.email})`);
      }
      
      console.log(`Cleaned up ${expiredUsers.length} expired demo accounts`);
    }
  } catch (error) {
    console.error('Error cleaning up expired demo accounts:', error);
  }
};

// First run is inside httpServer.listen after Mongo connects; then hourly
setInterval(cleanupExpiredDemoAccounts, 60 * 60 * 1000); // Every hour
