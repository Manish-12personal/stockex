import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';

dotenv.config();

const addIsLoginField = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Update all users to have isLogin field set to false by default
    const result = await User.updateMany(
      { isLogin: { $exists: false } }, // Only update users without the field
      { $set: { isLogin: false } }
    );

    console.log(`Updated ${result.modifiedCount} users with isLogin field`);

    // Also set isLogin to false for users who might have null or undefined
    const result2 = await User.updateMany(
      { $or: [{ isLogin: null }, { isLogin: undefined }] },
      { $set: { isLogin: false } }
    );

    console.log(`Fixed ${result2.modifiedCount} users with null/undefined isLogin`);

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

addIsLoginField();
