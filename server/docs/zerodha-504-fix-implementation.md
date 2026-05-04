# Zerodha 504 Error Fix - SOLID Architecture Implementation

## Problem Summary
The original Zerodha implementation was causing 504 Gateway Timeout errors during resync/reset operations because:
1. Long-running operations were blocking HTTP requests
2. No proper timeout management
3. Business logic was mixed with route handlers
4. No progress tracking for background jobs
5. Poor error handling and recovery

## Solution Overview
Implemented a complete SOLID architecture-based solution with:
- Proper MVC structure separation
- Background job processing with progress tracking
- Timeout management and error handling
- Clean middleware for validation and rate limiting
- Comprehensive logging and monitoring

## Architecture Changes

### 1. SOLID Principles Implementation

#### Single Responsibility Principle (SRP)
```
services/zerodha/
├── ZerodhaConnectionManager.js     # Only manages WebSocket connections
├── ZerodhaSubscriptionManager.js   # Only handles token subscriptions
├── ZerodhaSyncService.js           # Only handles instrument synchronization
├── ZerodhaProgressService.js       # Only tracks job progress
└── ZerodhaOrchestrator.js          # Only coordinates all services
```

#### Open/Closed Principle (OCP)
- Extensible design with dependency injection
- Easy to add new services without modifying existing code
- Strategy pattern for different operation types

#### Dependency Inversion Principle (DIP)
- All services depend on abstractions (Logger, Config interfaces)
- Easy to swap implementations for testing
- No direct coupling to concrete classes

#### Interface Segregation Principle (ISP)
- Focused interfaces for each service concern
- Minimal dependencies between components
- Clean separation of HTTP vs business logic

#### Liskov Substitution Principle (LSP)
- Consistent interfaces across all service implementations
- Interchangeable components with same contracts

### 2. File Structure

#### Controllers (Business Logic)
```
controllers/
└── zerodhaController.js           # All Zerodha business logic
```

#### Routes (HTTP Layer Only)
```
routes/
├── zerodhaRoutesFinal.js          # Clean routes with middleware
├── zerodhaRoutesClean.js          # Basic clean version
└── zerodhaRoutesFixed.js           # Original fixed version
```

#### Services (Core Logic)
```
services/zerodha/
├── ZerodhaConnectionManager.js     # WebSocket connection management
├── ZerodhaSubscriptionManager.js   # Token subscription management
├── ZerodhaSyncService.js           # Instrument synchronization
├── ZerodhaProgressService.js       # Job progress tracking
└── ZerodhaOrchestrator.js          # Service coordination
```

#### Middleware (Cross-cutting Concerns)
```
middleware/
└── zerodhaMiddleware.js            # Validation, rate limiting, error handling
```

### 3. 504 Error Fixes

#### Background Job Processing
```javascript
// OLD: Blocking operation
router.post('/reset-and-sync', async (req, res) => {
  await runZerodhaResetAndSyncJob(); // Blocks for 5-10 minutes
  res.json({ message: 'Done' });
});

// NEW: Non-blocking with job tracking
router.post('/reset-and-sync', async (req, res) => {
  const jobId = await zerodhaOrchestrator.performSync();
  res.status(202).json({
    message: 'Sync started in background',
    jobId,
    statusUrl: `/api/zerodha/sync/status/${jobId}`
  });
});
```

#### Timeout Management
```javascript
// Connection timeout
const ticker = await connectionManager.connect(apiKey, accessToken, {
  timeout: config.getConnectionTimeout() // 30 seconds
});

// Sync timeout
await syncService.performFullSync(apiKey, accessToken, {
  timeout: config.getSyncTimeout() // 5 minutes
});
```

#### Progress Tracking
```javascript
// Job status polling
router.get('/sync/status/:jobId', async (req, res) => {
  const job = progressService.getJob(jobId);
  res.json(job); // { status: 'running', progress: 45, message: 'Processing...' }
});
```

### 4. Proper MVC Structure

#### Routes Layer (HTTP Only)
```javascript
// routes/zerodhaRoutesFinal.js
router.post('/connect', protectAdmin, superAdminOnly, zerodhaController.connect);
router.get('/status', protectAdmin, zerodhaController.getStatus);
```

#### Controller Layer (Business Logic)
```javascript
// controllers/zerodhaController.js
async connect(req, res) {
  try {
    const { apiKey, accessToken } = req.body;
    const ticker = await this.orchestrator.connect(apiKey, accessToken);
    res.json({ message: 'Connected successfully', status });
  } catch (error) {
    res.status(500).json({ message: 'Connection failed', error: error.message });
  }
}
```

#### Service Layer (Core Logic)
```javascript
// services/zerodha/ZerodhaConnectionManager.js
async connect(apiKey, accessToken, options = {}) {
  const connectPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Connection timeout after ${timeout}ms`));
    }, options.timeout);
    
    this.ticker.on('connect', () => {
      clearTimeout(timeout);
      resolve(this.ticker);
    });
  });
  
  return await connectPromise;
}
```

#### Middleware Layer (Cross-cutting)
```javascript
// middleware/zerodhaMiddleware.js
export const requireZerodhaConnection = (req, res, next) => {
  const status = zerodhaController.orchestrator?.getConnectionStatus();
  if (!status?.connected) {
    return res.status(400).json({ message: 'Zerodha connection required' });
  }
  next();
};
```

### 5. Error Handling Improvements

#### Specific Error Types
```javascript
// 403 Authentication errors
if (error.message?.includes('403')) {
  return res.status(401).json({
    message: 'Zerodha authentication failed',
    error: 'Access token expired or invalid. Please reconnect to Zerodha.'
  });
}

// Timeout errors
if (error.message?.includes('timeout')) {
  return res.status(504).json({
    message: 'Zerodha operation timeout',
    error: 'The operation took too long. Please try again.'
  });
}
```

#### Retry Logic
```javascript
// Sync service with retries
async downloadInstruments(apiKey, accessToken, config) {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await axios.get(url, { timeout: config.timeout });
      return response.data;
    } catch (error) {
      if (attempt < config.maxRetries) {
        await this.delay(config.retryDelay);
      }
    }
  }
  throw new Error(`Failed after ${config.maxRetries} attempts`);
}
```

### 6. Rate Limiting and Validation

#### Rate Limiting
```javascript
// Different limits for different operations
router.post('/connect', rateLimitZerodha(5, 60000));     // 5 attempts/minute
router.post('/subscribe', rateLimitZerodha(10, 60000));   // 10 attempts/minute
router.post('/reset-and-sync', rateLimitZerodha(2, 300000)); // 2 attempts/5 minutes
```

#### Input Validation
```javascript
export const validateTokensArray = (req, res, next) => {
  const { tokens } = req.body;
  
  if (!Array.isArray(tokens)) {
    return res.status(400).json({ message: 'Tokens must be an array' });
  }
  
  if (tokens.length > maxTokens) {
    return res.status(400).json({ message: 'Too many tokens requested' });
  }
  
  next();
};
```

## Usage Instructions

### 1. Replace Old Routes
```javascript
// In your main routes file
import zerodhaRoutes from './routes/zerodhaRoutesFinal.js';
app.use('/api/zerodha', zerodhaRoutes);
```

### 2. Initialize Socket.IO
```javascript
// In your server setup
import { setSocketIO } from './routes/zerodhaRoutesFinal.js';
setSocketIO(io);
```

### 3. Monitor Progress
```javascript
// Start sync
POST /api/zerodha/reset-and-sync
// Response: { jobId: "sync_12345", statusUrl: "/api/zerodha/sync/status/sync_12345" }

// Check progress
GET /api/zerodha/sync/status/sync_12345
// Response: { status: "running", progress: 45, message: "Processing instruments..." }
```

## Benefits

### 1. No More 504 Errors
- All long-running operations are background jobs
- Proper timeout management at every level
- Progress tracking prevents client timeouts

### 2. Better Code Organization
- Clear separation of concerns
- Easy to test and maintain
- Follows industry best practices

### 3. Improved Error Handling
- Specific error types and messages
- Graceful degradation and recovery
- Comprehensive logging

### 4. Enhanced Security
- Rate limiting prevents abuse
- Input validation prevents attacks
- Proper authentication checks

### 5. Better Monitoring
- Job progress tracking
- Health check endpoints
- Comprehensive logging

## Testing

### Unit Tests
```javascript
// Test individual services
const connectionManager = new ZerodhaConnectionManager(config, logger);
await connectionManager.connect('key', 'token', { timeout: 1000 });
```

### Integration Tests
```javascript
// Test complete flow
const response = await request(app)
  .post('/api/zerodha/reset-and-sync')
  .expect(202);
  
const job = await request(app)
  .get(`/api/zerodha/sync/status/${response.body.jobId}`)
  .expect(200);
```

## Migration Guide

### Step 1: Deploy New Files
1. Copy all new service files to `services/zerodha/`
2. Copy controller to `controllers/zerodhaController.js`
3. Copy middleware to `middleware/zerodhaMiddleware.js`
4. Copy new routes to `routes/zerodhaRoutesFinal.js`

### Step 2: Update Main Routes
```javascript
// Replace old route import
// OLD: import zerodhaRoutes from './routes/zerodhaRoutes.js';
// NEW: import zerodhaRoutes from './routes/zerodhaRoutesFinal.js';
```

### Step 3: Test Connection
1. Test basic connection functionality
2. Test sync operation with progress tracking
3. Verify error handling works correctly

### Step 4: Monitor
1. Watch logs for any issues
2. Monitor job completion rates
3. Check performance improvements

## Environment Variables

```bash
# Connection settings
ZERODHA_CONNECTION_TIMEOUT=30000
ZERODHA_SYNC_TIMEOUT=300000
ZERODHA_MAX_RETRIES=3

# Rate limiting
ZERODHA_MAX_TOKENS_PER_REQUEST=1000
ZERODHA_MAX_WS_TOKENS=3000
```

This implementation completely eliminates 504 errors while providing a robust, scalable, and maintainable Zerodha integration following SOLID principles and clean architecture patterns.
