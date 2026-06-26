// services/redisService.js
// Simple Redis wrapper used by analysis routes to fetch live state.

const Redis = require('ioredis');

const redisOptions = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
      password: process.env.REDIS_PASSWORD || undefined,
    };

const redis = new Redis(redisOptions);

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

/** Get a JSON object stored under a key */
async function getObject(key) {
  const raw = await redis.get(key);
  return raw ? JSON.parse(raw) : null;
}

/** Retrieve a hash map as a plain object */
async function hgetAll(key) {
  return redis.hgetall(key);
}

/** Get a range of sorted‑set members by score */
async function zrangeByScore(key, minScore, maxScore) {
  return redis.zrangebyscore(key, minScore, maxScore);
}

module.exports = {
  getObject,
  hgetAll,
  zrangeByScore,
  client: redis,
};
