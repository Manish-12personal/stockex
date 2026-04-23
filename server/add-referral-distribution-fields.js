import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server directory
dotenv.config({ path: path.join(__dirname, '.env') });

import GameSettings from './models/GameSettings.js';

async function addReferralDistributionFields() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get existing GameSettings
    let settings = await GameSettings.findOne();
    
    if (!settings) {
      console.log('No GameSettings found, creating new one...');
      settings = await GameSettings.create({});
    }

    console.log('Current GameSettings found, updating referral distribution fields...');

    // Update referral distribution for each game
    const updates = {
      'games.niftyUpDown.referralDistribution': {
        winPercent: 10
      },
      'games.niftyNumber.referralDistribution': {
        winPercent: 10
      },
      'games.niftyJackpot.referralDistribution': {
        winPercent: 5,
        topRanksOnly: true,
        topRanksCount: 3
      },
      'games.niftyBracket.referralDistribution': {
        winPercent: 2
      },
      'games.btcUpDown.referralDistribution': {
        winPercent: 10
      }
    };

    // Apply updates
    for (const [path, value] of Object.entries(updates)) {
      const pathParts = path.split('.');
      const gameName = pathParts[1];
      const fieldName = pathParts[2];
      
      // Check if field exists
      let currentValue = settings;
      for (const part of pathParts) {
        currentValue = currentValue?.[part];
      }
      
      if (currentValue === undefined) {
        console.log(`Adding ${gameName}.${fieldName}...`);
        await GameSettings.updateOne(
          { _id: settings._id },
          { $set: { [path]: value } }
        );
      } else {
        console.log(`${gameName}.${fieldName} already exists, skipping...`);
      }
    }

    // Reload settings to verify
    settings = await GameSettings.findOne();
    console.log('\nUpdated GameSettings:');
    console.log('niftyUpDown.referralDistribution:', settings.games.niftyUpDown.referralDistribution);
    console.log('niftyNumber.referralDistribution:', settings.games.niftyNumber.referralDistribution);
    console.log('niftyJackpot.referralDistribution:', settings.games.niftyJackpot.referralDistribution);
    console.log('niftyBracket.referralDistribution:', settings.games.niftyBracket.referralDistribution);
    console.log('btcUpDown.referralDistribution:', settings.games.btcUpDown.referralDistribution);

    console.log('\n✅ Referral distribution fields added successfully!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
    process.exit(0);
  }
}

addReferralDistributionFields();
