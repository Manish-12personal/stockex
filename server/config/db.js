import mongoose from 'mongoose';
import NiftyJackpotBid from '../models/NiftyJackpotBid.js';
import UpDownWindowSettlement from '../models/UpDownWindowSettlement.js';
import { getTodayISTString } from '../utils/istDate.js';

async function migrateUpDownWindowSettlementDay() {
  try {
    const coll = UpDownWindowSettlement.collection;
    const need = await UpDownWindowSettlement.find({
      $or: [{ settlementDay: { $exists: false } }, { settlementDay: null }, { settlementDay: '' }],
    })
      .select({ _id: 1, createdAt: 1 })
      .lean();

    let n = 0;
    for (const doc of need) {
      const key = getTodayISTString(doc.createdAt || new Date());
      await coll.updateOne({ _id: doc._id }, { $set: { settlementDay: key } });
      n += 1;
    }
    if (n > 0) {
      console.log(`[DB] Backfilled settlementDay on ${n} UpDownWindowSettlement doc(s)`);
    }
    const indexes = await coll.indexes();
    const legacy = indexes.find(
      (i) =>
        i.unique &&
        i.key &&
        i.key.user === 1 &&
        i.key.gameId === 1 &&
        i.key.windowNumber === 1 &&
        i.key.settlementDay == null
    );
    if (legacy?.name) {
      await coll.dropIndex(legacy.name);
      console.log(`[DB] Dropped legacy UpDownWindowSettlement index ${legacy.name}`);
    }
    await UpDownWindowSettlement.syncIndexes();
  } catch (e) {
    console.warn('[DB] UpDownWindowSettlement migrate:', e.message);
  }
}

async function migrateNiftyJackpotIndexes() {
  try {
    const coll = NiftyJackpotBid.collection;
    const indexes = await coll.indexes();
    const legacy = indexes.find((i) => i.name === 'user_1_betDate_1' && i.unique);
    if (legacy) {
      await coll.dropIndex('user_1_betDate_1');
      console.log('[DB] Dropped unique user_1_betDate_1 on niftyjackpotbids (multi ticket per day)');
    }
    await NiftyJackpotBid.syncIndexes();
  } catch (e) {
    console.warn('[DB] NiftyJackpot index migrate:', e.message);
  }
}

const connectDB = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in server/.env');
  }
  console.log('[DB] Connecting to MongoDB (timeout 15s)...');
  const conn = await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log(`MongoDB Connected: ${conn.connection.host}`);
  await migrateNiftyJackpotIndexes();
  await migrateUpDownWindowSettlementDay();
  return conn;
};

export default connectDB;
