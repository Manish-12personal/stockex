import SystemSettings from '../models/SystemSettings.js';
import User from '../models/User.js';
import Admin from '../models/Admin.js';
import WalletLedger from '../models/WalletLedger.js';
import PlatformChargeLedger from '../models/PlatformChargeLedger.js';
import { findActiveSuperAdmin } from '../utils/btcUpDownSuperAdminPool.js';
import { getTodayISTString } from '../utils/istDate.js';
import { firstBillablePlatformChargeDayKey, isUserInPlatformChargeGrace } from '../utils/platformChargeDates.js';

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getEffectivePlatformChargeConfig() {
  const doc = await SystemSettings.findOne({ settingsType: 'global' })
    .select('platformCharges')
    .lean();
  const pc = doc?.platformCharges || {};
  return {
    enabled: Boolean(pc.enabled),
    dailyAmountInr: Math.max(0, num(pc.dailyAmountInr, 25)),
    graceDays: Math.max(0, Math.floor(num(pc.graceDays, 15))),
  };
}

function mainWalletBalance(user) {
  const w = user.wallet || {};
  const cash = num(w.cashBalance, NaN);
  if (Number.isFinite(cash)) return cash;
  return num(w.balance, 0);
}

function debitDescriptionUser(u) {
  const id = u.userId || u.username || String(u._id);
  return `user ${id}`;
}

function isMongoDup(err) {
  return err && (err.code === 11000 || err.code === 11001);
}

/**
 * Daily platform fee: debit user main wallet, credit active Super Admin admin wallet.
 * @param {{ chargeDayKey?: string }} opts chargeDayKey IST YYYY-MM-DD (default: today IST)
 */
export async function runDailyPlatformCharges(opts = {}) {
  const cfg = await getEffectivePlatformChargeConfig();
  const summary = {
    skippedDisabled: !cfg.enabled,
    chargeDayKey: opts.chargeDayKey || getTodayISTString(),
    dailyAmountInr: cfg.dailyAmountInr,
    graceDays: cfg.graceDays,
    examined: 0,
    charged: 0,
    failedInsufficient: 0,
    skippedGrace: 0,
    skippedDuplicate: 0,
    errors: [],
  };

  if (!cfg.enabled || cfg.dailyAmountInr <= 0) {
    return summary;
  }

  const chargeDayKey = summary.chargeDayKey;
  const superAdmin = await findActiveSuperAdmin();
  if (!superAdmin?._id) {
    summary.errors.push('NO_SUPER_ADMIN');
    return summary;
  }

  const amount = cfg.dailyAmountInr;
  const cursor = User.find({
    isDemo: { $ne: true },
    isActive: { $ne: false },
  })
    .select('_id username userId adminCode wallet createdAt')
    .cursor();

  for await (const user of cursor) {
    summary.examined += 1;
    try {
      const dup = await PlatformChargeLedger.findOne({
        user: user._id,
        chargeDayKey,
      })
        .select('_id')
        .lean();
      if (dup) {
        summary.skippedDuplicate += 1;
        continue;
      }

      if (isUserInPlatformChargeGrace(user.createdAt, cfg.graceDays, chargeDayKey)) {
        summary.skippedGrace += 1;
        continue;
      }

      const bal = mainWalletBalance(user);
      if (bal < amount) {
        try {
          await PlatformChargeLedger.create({
            user: user._id,
            chargeDayKey,
            amount,
            status: 'FAILED',
            failureReason: 'INSUFFICIENT_BALANCE',
            superAdminAdminId: superAdmin._id,
          });
          summary.failedInsufficient += 1;
        } catch (e) {
          if (isMongoDup(e)) summary.skippedDuplicate += 1;
          else summary.errors.push(`${user._id}:${e?.message || e}`);
        }
        continue;
      }

      const debited = await User.findOneAndUpdate(
        {
          _id: user._id,
          'wallet.cashBalance': { $gte: amount },
        },
        {
          $inc: {
            'wallet.cashBalance': -amount,
            'wallet.balance': -amount,
          },
        },
        { new: true }
      ).select('wallet adminCode username userId');

      if (!debited) {
        try {
          await PlatformChargeLedger.create({
            user: user._id,
            chargeDayKey,
            amount,
            status: 'FAILED',
            failureReason: 'INSUFFICIENT_BALANCE',
            superAdminAdminId: superAdmin._id,
          });
          summary.failedInsufficient += 1;
        } catch (e) {
          if (isMongoDup(e)) summary.skippedDuplicate += 1;
          else summary.errors.push(`${user._id}:${e?.message || e}`);
        }
        continue;
      }

      let saUpdated = null;
      try {
        saUpdated = await Admin.findOneAndUpdate(
          { _id: superAdmin._id, role: 'SUPER_ADMIN', status: 'ACTIVE' },
          { $inc: { 'wallet.balance': amount } },
          { new: true }
        ).select('wallet adminCode username');

        if (!saUpdated) {
          throw new Error('NO_SUPER_ADMIN');
        }

        const userBalAfter = mainWalletBalance(debited);
        const saBalAfter = num(saUpdated.wallet?.balance, 0);

        await WalletLedger.create([
          {
            ownerType: 'USER',
            ownerId: user._id,
            adminCode: debited.adminCode,
            type: 'DEBIT',
            reason: 'PLATFORM_CHARGE_DEBIT',
            amount,
            balanceAfter: userBalAfter,
            description: `Platform daily fee (IST ${chargeDayKey})`,
            meta: { chargeDayKey },
          },
          {
            ownerType: 'ADMIN',
            ownerId: saUpdated._id,
            adminCode: saUpdated.adminCode,
            type: 'CREDIT',
            reason: 'PLATFORM_CHARGE_CREDIT',
            amount,
            balanceAfter: saBalAfter,
            description: `Platform daily fee (${debitDescriptionUser(debited)}) IST ${chargeDayKey}`,
            meta: { chargeDayKey, sourceUserId: user._id },
          },
        ]);

        await PlatformChargeLedger.create({
          user: user._id,
          chargeDayKey,
          amount,
          status: 'CHARGED',
          failureReason: '',
          superAdminAdminId: saUpdated._id,
        });
        summary.charged += 1;
      } catch (e) {
        await User.updateOne(
          { _id: user._id },
          { $inc: { 'wallet.cashBalance': amount, 'wallet.balance': amount } }
        );
        if (saUpdated) {
          await Admin.updateOne({ _id: saUpdated._id }, { $inc: { 'wallet.balance': -amount } });
        }
        if (isMongoDup(e)) {
          summary.skippedDuplicate += 1;
        } else {
          summary.errors.push(`${user._id}:${e?.message || e}`);
        }
      }
    } catch (err) {
      summary.errors.push(`${user._id}:${err?.message || err}`);
    }
  }

  return summary;
}

export async function buildUserPlatformChargeStatus(userDoc) {
  const cfg = await getEffectivePlatformChargeConfig();
  const chargeDayKey = getTodayISTString();
  const firstBillable = firstBillablePlatformChargeDayKey(userDoc.createdAt, cfg.graceDays);
  const inGrace = isUserInPlatformChargeGrace(userDoc.createdAt, cfg.graceDays, chargeDayKey);

  let todayLedger = null;
  if (cfg.enabled && cfg.dailyAmountInr > 0 && !userDoc.isDemo && userDoc.isActive !== false) {
    todayLedger = await PlatformChargeLedger.findOne({
      user: userDoc._id,
      chargeDayKey,
    })
      .select('status amount failureReason')
      .lean();
  }

  const mainBal = mainWalletBalance(userDoc);

  return {
    enabled: cfg.enabled,
    dailyAmountInr: cfg.dailyAmountInr,
    graceDays: cfg.graceDays,
    istToday: chargeDayKey,
    firstBillableDayKey: firstBillable,
    inGracePeriod: inGrace,
    mainWalletBalance: mainBal,
    todayStatus: todayLedger
      ? {
          status: todayLedger.status,
          amount: todayLedger.amount,
          failureReason: todayLedger.failureReason || '',
        }
      : null,
  };
}

/** Super Admin report: ledger rows with optional IST day range filter. */
export async function getPlatformChargeReport(query) {
  const fromKey = query.from && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : null;
  const toKey = query.to && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : null;
  const dayKey =
    query.day && /^\d{4}-\d{2}-\d{2}$/.test(query.day) ? query.day : null;

  const filter = {};
  if (dayKey) filter.chargeDayKey = dayKey;
  else if (fromKey || toKey) {
    filter.chargeDayKey = {};
    if (fromKey) filter.chargeDayKey.$gte = fromKey;
    if (toKey) filter.chargeDayKey.$lte = toKey;
  }

  const limit = Math.min(500, Math.max(1, parseInt(String(query.limit || '100'), 10) || 100));
  const skip = Math.max(0, parseInt(String(query.skip || '0'), 10) || 0);

  const rows = await PlatformChargeLedger.find(filter)
    .sort({ chargeDayKey: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username userId adminCode')
    .lean();

  const agg = await PlatformChargeLedger.aggregate([
    { $match: filter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
      },
    },
  ]);

  const totalsByStatus = {};
  let chargedSum = 0;
  let chargedCount = 0;
  for (const a of agg) {
    totalsByStatus[a._id] = { count: a.count, totalAmount: a.totalAmount };
    if (a._id === 'CHARGED') {
      chargedSum = a.totalAmount;
      chargedCount = a.count;
    }
  }

  const totalMatching = await PlatformChargeLedger.countDocuments(filter);

  return {
    filter,
    skip,
    limit,
    totalMatching,
    totalsByStatus,
    chargedCount,
    chargedSum,
    rows,
  };
}
