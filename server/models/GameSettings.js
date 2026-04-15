import mongoose from 'mongoose';

const gameConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  minTickets: { type: Number, default: 1 },
  maxTickets: { type: Number, default: 500 },
  winMultiplier: { type: Number, default: 2 }, // e.g., 2x for up/down
  brokeragePercent: { type: Number, default: 5 }, // Platform fee on winnings
  roundDuration: { type: Number, default: 60 }, // seconds
  cooldownBetweenRounds: { type: Number, default: 5 }, // seconds
  maxBetsPerRound: { type: Number, default: 100 }, // max bets user can place per round
  displayOrder: { type: Number, default: 0 },
  // Per-game ticket price (₹ per ticket); user API falls back to global tokenValue if unset
  ticketPrice: { type: Number },
  profitUserPercent: { type: Number, default: 0 },
  subBrokerShareToBroker: { type: Boolean, default: true },
  /** 0 = unlimited. Nifty/BTC Up/Down: max tickets staked on that side per window (IST day + window #). */
  maxTicketsUpPerWindow: { type: Number, default: 0 },
  maxTicketsDownPerWindow: { type: Number, default: 0 },
  /** 0 = unlimited. Nifty Bracket: max tickets on BUY vs SELL side per IST calendar day. */
  maxTicketsBuyPerDay: { type: Number, default: 0 },
  maxTicketsSellPerDay: { type: Number, default: 0 },
}, { _id: false });

const gameSettingsSchema = new mongoose.Schema({
  // Global Settings
  gamesEnabled: { type: Boolean, default: true },
  maintenanceMode: { type: Boolean, default: false },
  maintenanceMessage: { type: String, default: 'Games are under maintenance. Please try again later.' },
  
  // Token System (1 token = tokenValue in ₹)
  tokenValue: { type: Number, default: 300 }, // 1 token = ₹300
  
  // Platform Commission
  platformCommission: { type: Number, default: 5 }, // Global platform fee %
  
  // Profit Distribution Hierarchy (% of win/brokerage amount)
  profitDistribution: {
    superAdminPercent: { type: Number, default: 40 },
    adminPercent: { type: Number, default: 30 },
    brokerPercent: { type: Number, default: 20 },
    subBrokerPercent: { type: Number, default: 10 }
    // Remaining (if any) auto goes to Super Admin
  },
  
  // Min/Max Global Limits
  globalMinTickets: { type: Number, default: 1 },
  globalMaxTickets: { type: Number, default: 1000 },
  dailyBetLimit: { type: Number, default: 500000 }, // Max a user can bet in a day
  dailyWinLimit: { type: Number, default: 1000000 }, // Max a user can win in a day

  /** Seconds after position expiry (window end / result minute) before unsettled stakes are refunded and removed */
  gamePositionExpiryGraceSeconds: { type: Number, default: 3600 },
  
  // Individual Game Settings
  games: {
    niftyUpDown: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Up/Down' },
      description: { type: String, default: 'Predict if Nifty will go UP or DOWN' },
      winMultiplier: { type: Number, default: 1.95 },
      /** Seconds per leg: bet window length; LTP after bet; result one more leg later (default 900 = 15 min). */
      roundDuration: { type: Number, default: 900 },
      enabled: { type: Boolean, default: true },
      minTickets: { type: Number, default: 1 },
      maxTickets: { type: Number, default: 500 },
      /** If sum > 0, win fee is % of gross win (like Nifty Number); else brokeragePercent on profit only */
      grossPrizeSubBrokerPercent: { type: Number, default: 0 },
      grossPrizeBrokerPercent: { type: Number, default: 0 },
      grossPrizeAdminPercent: { type: Number, default: 0 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      profitSubBrokerPercent: { type: Number, default: 10 },
      profitBrokerPercent: { type: Number, default: 20 },
      profitAdminPercent: { type: Number, default: 30 },
      startTime: { type: String, default: '09:15:00' },
      endTime: { type: String, default: '15:44:59' }
    },
    niftyNumber: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Number' },
      description: { type: String, default: 'Pick a decimal (.00-.99) of Nifty closing price' },
      winMultiplier: { type: Number, default: 9 },
      roundDuration: { type: Number, default: 86400 }, // 1 day in seconds
      enabled: { type: Boolean, default: true },
      minTickets: { type: Number, default: 1 },
      maxTickets: { type: Number, default: 100 },
      /** 0 when using grossPrize* hierarchy % of gross win slice; legacy setups may set >0 with gross all 0 */
      brokeragePercent: { type: Number, default: 0 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      fixedProfit: { type: Number, default: 4000 }, // Fixed profit on win (gross before hierarchy / brokerage)
      /**
       * Hierarchy fees as % of winner gross slice G (fixedProfit × quantity), not % of ticket.
       * If sum > 0, declare uses these cuts from G and skips brokeragePercent for net prize (same as Nifty Jackpot).
       */
      grossPrizeSubBrokerPercent: { type: Number, default: 2 },
      grossPrizeBrokerPercent: { type: Number, default: 1 },
      grossPrizeAdminPercent: { type: Number, default: 0.5 },
      profitSubBrokerPercent: { type: Number, default: 10 },
      profitBrokerPercent: { type: Number, default: 20 },
      profitAdminPercent: { type: Number, default: 30 },
      resultTime: { type: String, default: '15:45' }, // IST — shown to users; admin declare-result applies win/loss
      maxBidTime: { type: String, default: '15:40' }, // Last time users can place bets
      betsPerDay: { type: Number, default: 10 }, // Max bets per user per day
      biddingStartTime: { type: String, default: '09:15' },
      biddingEndTime: { type: String, default: '15:24' },
      startTime: { type: String, default: '09:15:15' },
      endTime: { type: String, default: '15:44:59' }
    },
    niftyJackpot: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Jackpot' },
      description: { type: String, default: 'Bid and compete for top ranks to win prizes' },
      winMultiplier: { type: Number, default: 1.5 },
      roundDuration: { type: Number, default: 86400 },
      enabled: { type: Boolean, default: true },
      minTickets: { type: Number, default: 1 },
      maxTickets: { type: Number, default: 100 },
      /** 0 when using grossPrize* hierarchy % of winner slice (TC3-style); legacy setups may set >0 with gross all 0 */
      brokeragePercent: { type: Number, default: 0 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      topWinners: { type: Number, default: 20 },
      prizeDistribution: { type: [Number], default: [45000, 10000, 8000, 6000, 5000, 4000, 3000, 2000, 1500, 1000] },
      resultTime: { type: String, default: '15:45' },
      /**
       * With maxTicketsPerRequest ≤ 1: max separate bid submissions per user per IST day.
       * With larger requests: max total tickets staked that day (sum of amounts ÷ ticket price).
       */
      bidsPerDay: { type: Number, default: 100 },
      /** Max tickets per single POST /nifty-jackpot/bid; 1 = one ticket per request (scenario / UX default) */
      maxTicketsPerRequest: { type: Number, default: 1 },
      /**
       * Hierarchy fees as % of winner gross slice G (kitty % × pool), not % of ticket.
       * If sum > 0, declare uses these cuts from G and skips brokeragePercent for net prize.
       */
      grossPrizeSubBrokerPercent: { type: Number, default: 2 },
      grossPrizeBrokerPercent: { type: Number, default: 1 },
      grossPrizeAdminPercent: { type: Number, default: 0.5 },
      profitSubBrokerPercent: { type: Number, default: 10 },
      profitBrokerPercent: { type: Number, default: 20 },
      profitAdminPercent: { type: Number, default: 30 },
      biddingStartTime: { type: String, default: '09:15' },
      biddingEndTime: { type: String, default: '14:59' },
      /** Per-rank % of total pool (kitty); rank 1 default 45% — see server/utils/niftyJackpotPrize.js */
      prizePercentages: {
        type: mongoose.Schema.Types.Mixed,
        default: () => [
          { rank: '1st', percent: 45 },
          { rank: '2nd', percent: 10 },
          { rank: '3rd', percent: 3 },
          { rank: '4th', percent: 2 },
          { rank: '5th', percent: 1.5 },
          { rank: '6th', percent: 1 },
          { rank: '7th', percent: 1 },
          { rank: '8th-10th', percent: 0.75 },
          { rank: '11th-20th', percent: 0.5 },
        ],
      },
      brokerageDistribution: { type: mongoose.Schema.Types.Mixed },
      startTime: { type: String, default: '09:15:15' },
      endTime: { type: String, default: '15:44:59' }
    },
    niftyBracket: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'Nifty Bracket' },
      description: { type: String, default: 'Buy/Sell on bracket levels around Nifty price' },
      /** ₹1,000/ticket stake → ₹1,900 gross at 1.9x */
      ticketPrice: { type: Number, default: 1000 },
      winMultiplier: { type: Number, default: 1.9 },
      roundDuration: { type: Number, default: 300 }, // 5 min max wait
      enabled: { type: Boolean, default: true },
      minTickets: { type: Number, default: 1 },
      maxTickets: { type: Number, default: 250 },
      /** % of gross win to hierarchy (funded from SA pool); sum >0 enables gross-hierarchy path */
      grossPrizeSubBrokerPercent: { type: Number, default: 2 },
      grossPrizeBrokerPercent: { type: Number, default: 1 },
      grossPrizeAdminPercent: { type: Number, default: 1 },
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      bracketGap: { type: Number, default: 20 }, // Points above/below spot (or entry) anchor
      /** If true, upper/lower are built from live Nifty spot at place time (ignores client entryPrice for centre) */
      bracketAnchorToSpot: { type: Boolean, default: true },
      /** BUY wins only if LTP > upperTarget; SELL wins only if LTP < lowerTarget (at settle) */
      bracketStrictLtpComparison: { type: Boolean, default: true },
      expiryMinutes: { type: Number, default: 5 }, // Intraday mode: minutes until expiry
      settleAtResultTime: { type: Boolean, default: true }, // true = settle only at resultTime IST (e.g. 3:31)
      profitSubBrokerPercent: { type: Number, default: 10 },
      profitBrokerPercent: { type: Number, default: 20 },
      profitAdminPercent: { type: Number, default: 30 },
      resultTime: { type: String, default: '15:31' }, // IST settlement clock (LTP at/after this instant)
      biddingStartTime: { type: String, default: '09:15:29' },
      /** HH:mm → inclusive through end of that minute (e.g. 15:29 = …:15:29:59) */
      biddingEndTime: { type: String, default: '15:29' },
      startTime: { type: String, default: '09:15:15' },
      endTime: { type: String, default: '15:44:59' }
    },
    btcUpDown: {
      ...gameConfigSchema.obj,
      name: { type: String, default: 'BTC Up/Down' },
      description: {
        type: String,
        default:
          'Predict BTC vs 15m windows (94 IST rounds/day by default). Winners receive full stake × multiplier; hierarchy from pool.',
      },
      winMultiplier: { type: Number, default: 1.95 },
      roundDuration: { type: Number, default: 60 },
      enabled: { type: Boolean, default: true },
      minTickets: { type: Number, default: 1 },
      maxTickets: { type: Number, default: 500 },
      grossPrizeSubBrokerPercent: { type: Number, default: 0 },
      grossPrizeBrokerPercent: { type: Number, default: 0 },
      grossPrizeAdminPercent: { type: Number, default: 0 },
      /** % of (grossWin − stake); total brokerage T debited from SA BTC pool for hierarchy split */
      brokeragePercent: { type: Number, default: 5 },
      buySellRatioBrokerage: { type: Number, default: 16.67 },
      /** % of T each (remainder of T → SA); used by distributeWinBrokerage with skipUserRebate for BTC */
      profitSubBrokerPercent: { type: Number, default: 5 },
      profitBrokerPercent: { type: Number, default: 1 },
      profitAdminPercent: { type: Number, default: 1 },
      startTime: { type: String, default: '00:00:01' },
      endTime: { type: String, default: '23:45:00' },
      allowedExpiryTimes: { type: [Number], default: [60, 120, 300, 600, 900] }, // 1m, 2m, 5m, 10m, 15m in seconds
      defaultExpiryTime: { type: Number, default: 60 } // Default 1 minute
    }
  },
  
  // Referral & Bonus Settings
  referralBonus: {
    enabled: { type: Boolean, default: true },
    referrerBonus: { type: Number, default: 100 }, // Amount referrer gets
    refereeBonus: { type: Number, default: 50 }, // Amount new user gets
    minDepositRequired: { type: Number, default: 500 } // Min deposit to activate bonus
  },
  
  // First Deposit Bonus
  firstDepositBonus: {
    enabled: { type: Boolean, default: true },
    bonusPercent: { type: Number, default: 100 }, // 100% bonus on first deposit
    maxBonus: { type: Number, default: 5000 }, // Max bonus amount
    wageringRequirement: { type: Number, default: 3 } // 3x wagering to withdraw
  },
  
  // Loss Cashback
  lossCashback: {
    enabled: { type: Boolean, default: false },
    cashbackPercent: { type: Number, default: 5 }, // 5% of net losses
    minLoss: { type: Number, default: 1000 }, // Min loss to qualify
    maxCashback: { type: Number, default: 10000 }, // Max cashback per period
    period: { type: String, enum: ['daily', 'weekly', 'monthly'], default: 'weekly' }
  },
  
  // Risk Management
  riskManagement: {
    maxExposurePerUser: { type: Number, default: 100000 }, // Max total bets at risk
    maxWinPerRound: { type: Number, default: 500000 }, // Max payout per round
    autoSuspendOnLargeWin: { type: Boolean, default: true },
    largeWinThreshold: { type: Number, default: 100000 }, // Auto review wins above this
    suspiciousActivityAlert: { type: Boolean, default: true }
  },

  // Trading Hours (when games are available)
  tradingHours: {
    enabled: { type: Boolean, default: false }, // If true, games only available during hours
    startTime: { type: String, default: '09:15' }, // IST
    endTime: { type: String, default: '15:30' }, // IST
    weekendEnabled: { type: Boolean, default: false }
  }
}, {
  timestamps: true
});

// Ensure only one settings document exists
gameSettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const GameSettings = mongoose.model('GameSettings', gameSettingsSchema);

export default GameSettings;
