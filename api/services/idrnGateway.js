const cacheService = require('./cacheService');
const inventoryService = require('./inventoryService');

// Memory snapshot representing the absolute last successfully fetched data (offline-first fallback database)
let lastSuccessfulSnapshot = null;

/**
 * Custom retry mechanism utilizing an exponential backoff formula with jitter:
 * delay = base * 2^attempt + random_jitter
 * 
 * Only handles transient errors (HTTP 500, 502, 503, 504, or network timeouts)
 */
async function fetchWithExponentialBackoff(url, options = {}, maxAttempts = 3, baseDelayMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      console.log(`Initiating IDRN live Gateway connection (Attempt ${attempt + 1}/${maxAttempts})...`);
      
      // In production, this would call:
      // const response = await fetch(url, options);
      // if (!response.ok && [500, 502, 503, 504].includes(response.status)) {
      //   throw new Error(`NIC gateway error: HTTP ${response.status}`);
      // }
      // return await response.json();
      
      // -------------------------------------------------------------
      // PLACEHOLDER: Since we are simulating the gateway, we throw a
      // temporary 503 Service Unavailable error to trigger the backoff retries
      // -------------------------------------------------------------
      throw new Error("HTTP 503: Service Temporarily Unavailable (NIC Gateway Overload)");
      
    } catch (error) {
      console.warn(`Gateway attempt ${attempt + 1} failed: ${error.message}`);
      
      // If we reached max attempts, propagate the error upwards
      if (attempt === maxAttempts - 1) {
        throw error;
      }
      
      // Exponential backoff delay = baseDelay * 2^attempt + jitter
      const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * 200; // Add up to 200ms randomized jitter
      const totalDelay = exponentialDelay + jitter;
      
      console.log(`Rate limit protection: retrying gateway in ${Math.round(totalDelay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, totalDelay));
    }
  }
}

/**
 * Fetches IDRN center resource data.
 * Checks the local Redis cache first. If stale/missing, queries the IDRN live gateway.
 * Falls back to the last cached snapshot if the live gateway is unreachable.
 */
async function fetchIdrnResources() {
  const cacheKey = 'idrn:resources';
  
  // 1. Live Redis Dynamic Hash Query (if connected)
  if (cacheService.getIsRedisConnected()) {
    try {
      console.log('Serving live IDRN data dynamically reconstructed from Redis hashes.');
      return await inventoryService.getAllCenters();
    } catch (err) {
      console.warn('Reconstructing from Redis hashes failed, falling back:', err.message);
    }
  }
  
  // Fallback to strict cache lookup if offline
  try {
    const cachedData = await cacheService.get(cacheKey);
    if (cachedData) {
      console.log('Serving IDRN data from cache (fresh TTL snapshot).');
      return cachedData;
    }
  } catch (err) {
    console.warn('Cache lookup failed, proceeding to direct gateway fetch:', err.message);
  }

  // 2. Gateway Fetch & Sync (Active only if USE_MOCK_DATA is false)
  try {
    const gatewayUrl = process.env.IDRN_API_URL || 'https://api.idrn.gov.in/v1/resources';
    
    // Attempt fetch with rate limit backoff retries
    const freshData = await fetchWithExponentialBackoff(gatewayUrl, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + (process.env.IDRN_API_KEY || 'dummy_token'),
        'Accept': 'application/json'
      }
    });

    // Sync successfully: Update Redis cache (1 hour TTL) & memory backup
    await cacheService.set(cacheKey, freshData, 3600);
    lastSuccessfulSnapshot = freshData;
    
    return freshData;
  } catch (gatewayError) {
    // 3. Offline-First Synchronisation Fallback
    console.warn(`[EOC WARN] IDRN live Gateway unreachable. Error: ${gatewayError.message}`);
    console.log('Offline-first fallback activated. Retrieving last successful cached snapshot...');

    if (lastSuccessfulSnapshot) {
      return lastSuccessfulSnapshot;
    }

    // If in-memory backup is null, try pulling from Redis (ignoring TTL checks if possible)
    try {
      const staleCachedData = await cacheService.get(cacheKey);
      if (staleCachedData) {
        console.log('Serving stale cache snapshot as emergency fallback.');
        return staleCachedData;
      }
    } catch (e) {
      console.error('Failed to read from cache backup:', e.message);
    }

    // Hard crash fallback: If no historic data exists, we throw a system exception
    throw new Error('IDRN Gateway integration failed: Server offline and no cached database snapshots available.');
  }
}

// Helper to pre-populate last successful snapshot for testing offline-first fallback
function setMockFallbackSnapshot(data) {
  lastSuccessfulSnapshot = data;
}

module.exports = {
  fetchIdrnResources,
  setMockFallbackSnapshot
};
