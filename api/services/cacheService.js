const redis = require('redis');

let redisClient = null;
let isRedisConnected = false;

// In-memory fallback cache to ensure offline resilience
const localCache = new Map();

/**
 * Initializes the Redis client connection.
 */
async function initCache() {
  const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
  console.log(`Connecting to Redis at ${redisUrl}...`);
  
  try {
    redisClient = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.warn('Redis reconnection attempts exhausted. Operating in fallback mode.');
            isRedisConnected = false;
            return false; // Stop reconnecting
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.warn('Redis Client connection error. Falling back to local cache. Error:', err.message);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully.');
      isRedisConnected = true;
    });

    await redisClient.connect();
  } catch (error) {
    console.warn('Could not establish Redis connection. Running in local cache fallback mode:', error.message);
    isRedisConnected = false;
  }
}

/**
 * Retrieves a parsed value from the cache.
 * @param {string} key 
 * @returns {Promise<any>}
 */
async function get(key) {
  if (isRedisConnected && redisClient) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return JSON.parse(data);
      }
    } catch (err) {
      console.error(`Redis GET error for key "${key}":`, err.message);
    }
  }

  // Local in-memory cache fallback
  const cached = localCache.get(key);
  if (cached) {
    if (Date.now() < cached.expiry) {
      return cached.value;
    }
    // Delete if expired
    localCache.delete(key);
  }
  return null;
}

/**
 * Sets a value in the cache with a specified TTL in seconds.
 * @param {string} key 
 * @param {any} value 
 * @param {number} ttlSeconds - Default 3600s (1 hour)
 */
async function set(key, value, ttlSeconds = 3600) {
  if (isRedisConnected && redisClient) {
    try {
      await redisClient.set(key, JSON.stringify(value), {
        EX: ttlSeconds
      });
      return;
    } catch (err) {
      console.error(`Redis SET error for key "${key}":`, err.message);
    }
  }

  // Local in-memory cache fallback
  localCache.set(key, {
    value,
    expiry: Date.now() + (ttlSeconds * 1000)
  });
}

module.exports = {
  initCache,
  get,
  set,
  getIsRedisConnected: () => isRedisConnected,
  getClient: () => redisClient
};
