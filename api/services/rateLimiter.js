const cacheService = require('./cacheService');

// Simple local counter for local in-memory fallback
const memoryLimitStore = new Map();

/**
 * Custom Redis-based rate limiter middleware.
 * If Redis is not connected, falls back to a clean in-memory map store.
 */
async function apiRateLimiter(req, res, next) {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const key = `ratelimit:${clientIp}`;
  
  const LIMIT = 60; // Max 60 requests
  const WINDOW_MS = 60 * 1000; // per 1 minute window

  try {
    if (cacheService.getIsRedisConnected()) {
      // Redis Implementation
      const currentCount = await cacheService.get(key) || 0;
      
      if (currentCount >= LIMIT) {
        return res.status(429).json({
          status: 429,
          error: 'Too Many Requests',
          message: `API rate limit of ${LIMIT} requests per minute exceeded. Please try again later.`
        });
      }
      
      // Increment and save (with window expiration)
      await cacheService.set(key, currentCount + 1, WINDOW_MS / 1000);
    } else {
      // In-Memory Fallback Implementation
      const now = Date.now();
      const clientData = memoryLimitStore.get(clientIp);
      
      if (!clientData) {
        memoryLimitStore.set(clientIp, { count: 1, resetTime: now + WINDOW_MS });
      } else {
        if (now > clientData.resetTime) {
          // Window expired, reset counter
          memoryLimitStore.set(clientIp, { count: 1, resetTime: now + WINDOW_MS });
        } else {
          if (clientData.count >= LIMIT) {
            return res.status(429).json({
              status: 429,
              error: 'Too Many Requests',
              message: `API rate limit of ${LIMIT} requests per minute exceeded. Please try again later.`
            });
          }
          clientData.count += 1;
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('Rate limiting middleware error (resilience fallback applied):', error.message);
    next(); // Pass control on error to ensure EOC systems stay online
  }
}

module.exports = apiRateLimiter;
