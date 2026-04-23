const mongoose = require('mongoose');
require('dotenv').config();

async function checkNiftyJackpot() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/stockex');
    const GameSettings = require('./models/GameSettings');
    const settings = await GameSettings.getSettings();
    
    console.log('Nifty Jackpot referralDistribution:');
    console.log(JSON.stringify(settings.games?.niftyJackpot?.referralDistribution, null, 2));
    
    console.log('\nAll games referralDistribution:');
    for (const [gameKey, gameData] of Object.entries(settings.games || {})) {
      console.log(`${gameKey}:`, gameData.referralDistribution);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkNiftyJackpot();
