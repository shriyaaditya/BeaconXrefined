/**
 * =========================================================================
 * ARCHITECTURE BREAKDOWN: DATA FLOW PIPELINE
 * =========================================================================
 * 
 * 1. [EOC Client Request] -> Initiated by EOC Dashboard /api/idrn endpoint.
 * 2. [Rate Limiter Middleware] -> Validates client request limit via Redis. If exceeded, returns 429.
 * 3. [IDRN Controller (GET)] -> Intercepts request and checks USE_MOCK_DATA env flag.
 *    │
 *    ├── [A. USE_MOCK_DATA = true] (Local Mock Mode)
 *    │   └── Reads local mock JSON (mock_idrn_data.json) from disk.
 *    │       ├── SUCCESS: Returns mock data directly.
 *    │       └── FAILURE: Handles local filesystem read faults with 500 error.
 *    │
 *    └── [B. USE_MOCK_DATA = false] (Live Gateway Mode)
 *        ├── Checks Local Caching Service (Redis with TTL 1 hour).
 *        │   ├── CACHE HIT: Serves cached data instantly (NIC Server Rate Protection).
 *        │   └── CACHE MISS: Calls direct IDRN Live Gateway Sync.
 *        │       ├── Initiates API connection with Exponential Backoff (3 retries).
 *        │       │   ├── SUCCESS: Updates cache and last-known-good backup database.
 *        │       │   └── GATEWAY FAIL: Triggers Offline-First Fallback.
 *        │       │       ├── Checks local memory/Redis backup for last-known-good data.
 *        │       │       │   ├── FOUND: Returns stale snapshot as emergency response.
 *        │       │       │   └── NOT FOUND: Returns 503 Gateway Unavailable.
 * =========================================================================
 */

const fs = require('fs').promises;
const path = require('path');
const idrnGateway = require('../services/idrnGateway');

const mockDataPath = path.join(__dirname, '../data/mock_idrn_data.json');

// Pre-populate the offline-first gateway fallback cache with local mock records on start
fs.readFile(mockDataPath, 'utf8')
  .then(data => {
    idrnGateway.setMockFallbackSnapshot(JSON.parse(data));
    console.log('Pre-populated offline-first fallback gateway cache successfully.');
  })
  .catch(err => console.warn('Could not pre-populate offline fallback database:', err.message));

/**
 * Controller handling retrieval of IDRN center resources.
 * Distinguishes local file read faults from downstream gateway synchronization issues.
 */
async function getIdrnResources(req, res) {
  const useMock = process.env.USE_MOCK_DATA === 'true';

  if (useMock) {
    console.log('IDRN controller: Reading from local mock database file...');
    try {
      const rawData = await fs.readFile(mockDataPath, 'utf8');
      const mockData = JSON.parse(rawData);
      
      return res.status(200).json({
        status: 'success',
        source: 'mock_local_file',
        timestamp: new Date().toISOString(),
        data: mockData
      });
    } catch (error) {
      console.error('IDRN controller local mock filesystem read failure:', error);
      return res.status(500).json({
        status: 'error',
        error: 'LocalFilesystemReadFault',
        message: 'Critical error: Failed to retrieve local mock database file. Please verify files exist under /backend/data/.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  // Live IDRN Gateway Synchronization Pipeline
  console.log('IDRN controller: Querying live IDRN gateway integration...');
  try {
    const data = await idrnGateway.fetchIdrnResources();
    return res.status(200).json({
      status: 'success',
      source: 'live_gateway_sync',
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('IDRN controller downstream NIC gateway connection failure:', error);
    return res.status(503).json({
      status: 'error',
      error: 'NICGatewaySyncFailure',
      message: 'Downstream IDRN gateway sync failed after retries and no cached database snapshot is available offline.'
    });
  }
}

module.exports = {
  getIdrnResources
};
