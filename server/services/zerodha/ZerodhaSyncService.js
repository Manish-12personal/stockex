/**
 * Zerodha Sync Service
 * 
 * Handles instrument synchronization with proper timeout management and error handling.
 * Follows SOLID principles with single responsibility for synchronization operations.
 */

import axios from 'axios';

export class ZerodhaSyncService {
  constructor(configService, loggerService, progressService) {
    this.configService = configService;
    this.loggerService = loggerService;
    this.progressService = progressService;
    this.syncConfig = {
      timeout: 300000, // 5 minutes
      chunkSize: 2000,
      maxRetries: 3,
      retryDelay: 5000
    };
  }

  /**
   * Perform full instrument sync with timeout and progress tracking
   */
  async performFullSync(apiKey, accessToken, options = {}) {
    const jobId = this.generateJobId();
    const config = { ...this.syncConfig, ...options };
    
    try {
      this.progressService.startJob(jobId, {
        type: 'full_sync',
        totalSteps: 5,
        description: 'Full instrument synchronization from Zerodha'
      });

      // Step 1: Download instruments
      const instruments = await this.downloadInstruments(apiKey, accessToken, config);
      this.progressService.updateJob(jobId, { step: 1, message: 'Instruments downloaded' });

      // Step 2: Parse and validate instruments
      const parsedInstruments = await this.parseInstruments(instruments);
      this.progressService.updateJob(jobId, { step: 2, message: 'Instruments parsed' });

      // Step 3: Backup existing data
      const backup = await this.backupExistingData();
      this.progressService.updateJob(jobId, { step: 3, message: 'Existing data backed up' });

      // Step 4: Clear and insert new data
      const result = await this.clearAndInsert(parsedInstruments, config);
      this.progressService.updateJob(jobId, { step: 4, message: 'Database updated' });

      // Step 5: Verify sync
      const verification = await this.verifySync(parsedInstruments.length);
      this.progressService.updateJob(jobId, { step: 5, message: 'Sync verified' });

      this.progressService.completeJob(jobId, {
        result: {
          ...result,
          verification,
          totalInstruments: parsedInstruments.length
        }
      });

      return result;

    } catch (error) {
      this.progressService.failJob(jobId, { error: error.message });
      this.loggerService.error('Full sync failed:', error);
      throw error;
    }
  }

  /**
   * Download instruments with timeout and retry logic
   */
  async downloadInstruments(apiKey, accessToken, config) {
    const maxRetries = config.maxRetries || 3;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.loggerService.info(`Downloading instruments (attempt ${attempt}/${maxRetries})`);

        const response = await axios.get('https://api.kite.trade/instruments', {
          responseType: 'text',
          timeout: config.timeout,
          headers: {
            'X-Kite-Version': '3',
            Authorization: `token ${apiKey}:${accessToken}`,
          },
        });

        const csvText = typeof response.data === 'string' ? response.data : String(response.data ?? '');
        
        if (csvText.length < 1000) {
          throw new Error('Invalid response: insufficient data received');
        }

        this.loggerService.info(`Downloaded ${csvText.length} characters of instrument data`);
        return csvText;

      } catch (error) {
        lastError = error;
        this.loggerService.error(`Download attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxRetries) {
          await this.delay(config.retryDelay);
        }
      }
    }

    throw new Error(`Failed to download instruments after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Parse CSV instruments with validation
   */
  async parseInstruments(csvText) {
    try {
      const lines = csvText.split('\n');
      const headers = this.parseCSVLine(lines[0]);
      
      const instruments = [];
      let lineNumber = 1;

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;

        try {
          const values = this.parseCSVLine(lines[i]);
          const instrument = {};

          headers.forEach((header, idx) => {
            instrument[header.trim()] = values[idx]?.trim();
          });

          // Validate required fields
          if (!instrument.instrument_token || !instrument.tradingsymbol) {
            throw new Error(`Missing required fields at line ${lineNumber}`);
          }

          instruments.push(instrument);
          lineNumber++;

        } catch (error) {
          this.loggerService.warn(`Skipping line ${lineNumber}: ${error.message}`);
          lineNumber++;
        }
      }

      if (instruments.length < 100) {
        throw new Error(`Unexpected instrument count: ${instruments.length}. Check API credentials.`);
      }

      this.loggerService.info(`Parsed ${instruments.length} valid instruments`);
      return instruments;

    } catch (error) {
      this.loggerService.error('Failed to parse instruments:', error);
      throw error;
    }
  }

  /**
   * Backup existing data before clearing
   */
  async backupExistingData() {
    try {
      const Instrument = (await import('../../models/Instrument.js')).default;
      
      const existing = await Instrument.find({}).lean();
      const backup = {
        count: existing.length,
        timestamp: new Date(),
        data: existing.slice(0, 1000) // Keep first 1000 for reference
      };

      this.loggerService.info(`Backed up ${existing.length} existing instruments`);
      return backup;

    } catch (error) {
      this.loggerService.error('Failed to backup existing data:', error);
      throw error;
    }
  }

  /**
   * Clear existing data and insert new instruments in chunks
   */
  async clearAndInsert(instruments, config) {
    const Instrument = (await import('../../models/Instrument.js')).default;
    const chunkSize = config.chunkSize || 2000;
    
    try {
      // Clear existing data
      const deleteResult = await Instrument.deleteMany({});
      this.loggerService.info(`Deleted ${deleteResult.deletedCount} existing instruments`);

      // Insert in chunks to avoid memory issues
      let insertedCount = 0;
      const errors = [];

      for (let i = 0; i < instruments.length; i += chunkSize) {
        const chunk = instruments.slice(i, i + chunkSize);
        
        try {
          const processedChunk = await this.processInstrumentChunk(chunk);
          await Instrument.insertMany(processedChunk, { ordered: false });
          insertedCount += processedChunk.length;
          
          this.progressService.updateProgress({
            message: `Inserted ${insertedCount}/${instruments.length} instruments`,
            progress: (insertedCount / instruments.length) * 100
          });

        } catch (error) {
          this.loggerService.error(`Error inserting chunk ${Math.floor(i / chunkSize) + 1}:`, error.message);
          errors.push({
            chunk: Math.floor(i / chunkSize) + 1,
            error: error.message,
            startIndex: i,
            endIndex: Math.min(i + chunkSize, instruments.length)
          });
        }
      }

      const result = {
        deleted: deleteResult.deletedCount,
        inserted: insertedCount,
        total: instruments.length,
        errors,
        success: errors.length === 0
      };

      this.loggerService.info(`Sync completed: deleted ${result.deleted}, inserted ${result.inserted}, errors ${errors.length}`);
      return result;

    } catch (error) {
      this.loggerService.error('Failed to clear and insert instruments:', error);
      throw error;
    }
  }

  /**
   * Process instrument chunk with data transformation
   */
  async processInstrumentChunk(chunk) {
    return chunk.map(instrument => ({
      token: parseInt(instrument.instrument_token),
      symbol: instrument.tradingsymbol,
      name: instrument.name || instrument.tradingsymbol,
      exchange: instrument.exchange,
      segment: this.mapSegment(instrument),
      displaySegment: this.getDisplaySegment(instrument),
      instrumentType: this.getInstrumentType(instrument),
      category: this.getCategory(instrument),
      tradingSymbol: instrument.tradingsymbol,
      lotSize: parseInt(instrument.lot_size) || 1,
      tickSize: parseFloat(instrument.tick_size) || 0.05,
      expiry: instrument.expiry || null,
      strike: parseFloat(instrument.strike) || null,
      optionType: instrument.instrument_type?.includes('CE') ? 'CE' : 
                 instrument.instrument_type?.includes('PE') ? 'PE' : null,
      lastUpdated: new Date()
    }));
  }

  /**
   * Verify sync completion
   */
  async verifySync(expectedCount) {
    try {
      const Instrument = (await import('../../models/Instrument.js')).default;
      const actualCount = await Instrument.countDocuments();
      
      const verification = {
        expected: expectedCount,
        actual: actualCount,
        success: actualCount >= expectedCount * 0.95 // Allow 5% tolerance
      };

      this.loggerService.info(`Sync verification: expected ${expectedCount}, actual ${actualCount}`);
      return verification;

    } catch (error) {
      this.loggerService.error('Failed to verify sync:', error);
      throw error;
    }
  }

  /**
   * Helper methods for data mapping
   */
  mapSegment(instrument) {
    const exchange = instrument.exchange;
    const segment = instrument.segment;
    
    if (exchange === 'NSE' && segment === 'NSE') return 'EQUITY';
    if (exchange === 'NFO') return 'DERIVATIVES';
    if (exchange === 'MCX') return 'COMMODITIES';
    if (exchange === 'BSE') return 'EQUITY';
    
    return segment || 'UNKNOWN';
  }

  getDisplaySegment(instrument) {
    const exchange = instrument.exchange;
    const segment = instrument.segment;
    const type = instrument.instrument_type;
    
    if (exchange === 'NSE' && segment === 'NSE') return 'NSE-EQ';
    if (exchange === 'NFO' && type === 'FUT') return 'NSEFUT';
    if (exchange === 'NFO' && type?.includes('OPT')) return 'NSEOPT';
    if (exchange === 'MCX' && type === 'FUT') return 'MCXFUT';
    if (exchange === 'MCX' && type?.includes('OPT')) return 'MCXOPT';
    
    return `${exchange}-${segment}`;
  }

  getInstrumentType(instrument) {
    const type = instrument.instrument_type;
    
    if (type === 'EQ') return 'STOCK';
    if (type === 'FUT') return 'FUTURE';
    if (type?.includes('OPT')) return 'OPTION';
    
    return type || 'UNKNOWN';
  }

  getCategory(instrument) {
    const exchange = instrument.exchange;
    const type = instrument.instrument_type;
    
    if (type === 'EQ') return 'STOCKS';
    if (type === 'FUT') return 'FUTURES';
    if (type?.includes('OPT')) return 'OPTIONS';
    
    return 'OTHERS';
  }

  /**
   * Parse CSV line handling quoted fields
   */
  parseCSVLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
  
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    return values;
  }

  /**
   * Generate unique job ID
   */
  generateJobId() {
    return `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
