import mongoose from 'mongoose';
import dotenv from 'dotenv';
import GameSettings from './models/GameSettings.js';

dotenv.config();

async function fixJackpotPrizes() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stockex');
    
    const settings = await GameSettings.getSettings();
    
    console.log('Current Nifty Jackpot prizePercentages:');
    console.log(JSON.stringify(settings.games?.niftyJackpot?.prizePercentages, null, 2));
    
    // Fix the prizePercentages to include all ranks with correct values and count
    const correctPrizePercentages = [
      { rank: '1st', percent: 45 },
      { rank: '2nd', percent: 10 },
      { rank: '3rd', percent: 3 },
      { rank: '4th', percent: 2 },
      { rank: '5th', percent: 1.5 },
      { rank: '6th', percent: 1 },
      { rank: '7th', percent: 1 },
      { rank: '8th-10th', percent: 0.75, count: 3 },
      { rank: '11th-20th', percent: 0.5, count: 10 },
    ];
    
    settings.games.niftyJackpot.prizePercentages = correctPrizePercentages;
    settings.markModified('games.niftyJackpot.prizePercentages');
    await settings.save();
    
    console.log('\n✓ Fixed Nifty Jackpot prizePercentages');
    console.log('New prizePercentages:');
    console.log(JSON.stringify(settings.games?.niftyJackpot?.prizePercentages, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixJackpotPrizes();
