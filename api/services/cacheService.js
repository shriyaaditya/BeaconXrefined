const redis = require('redis');
const dbService = require('./dbService');

let redisClient = null;
let isRedisConnected = false;

const localCache = new Map();

async function warmUpCache() {
  console.log('[CACHE WARMUP] Starting async cache warmup from PostgreSQL...');
  try {
    const query = `
      SELECT
        c.center_code, c.name as center_name, c.latitude, c.longitude, c.district, c.region, c.updated_at as center_updated_at,
        r.resource_code, r.name as resource_name, r.category, r.unit,
        i.available_qty, i.min_threshold, i.updated_at as inv_updated_at
      FROM centers c
      LEFT JOIN inventory i ON c.id = i.center_id
      LEFT JOIN resources r ON i.resource_id = r.id
    `;
    const result = await dbService.query(query);
    
    const centerMap = {};
    for (const row of result.rows) {
      if (!centerMap[row.center_code]) {
        centerMap[row.center_code] = {
          metadata: {
            name: row.center_name,
            lat: String(row.latitude || 0),
            lng: String(row.longitude || 0),
            district: row.district,
            region: row.region,
            last_sync: row.center_updated_at ? row.center_updated_at.toISOString() : new Date().toISOString(),
            critical_count: 0,
            health_score: 100
          },
          resources: []
        };
      }
      
      if (row.resource_code) {
        centerMap[row.center_code].resources.push({
          item_code: row.resource_code,
          name: row.resource_name,
          category: row.category,
          unit: row.unit,
          available_qty: row.available_qty,
          min_threshold: row.min_threshold,
          status: row.available_qty < row.min_threshold ? 'Critical' : 'Adequate',
          last_updated: row.inv_updated_at ? row.inv_updated_at.toISOString() : new Date().toISOString()
        });
      }
    }

    const multi = redisClient.multi();
    
    // Clear existing sets to avoid stale data
    const existingCenters = await redisClient.sMembers('idrn:centers');
    for (const code of existingCenters) {
      multi.del(`idrn:center:metadata:${code}`);
      const resCodes = await redisClient.sMembers(`idrn:center:resources:${code}`);
      for (const resCode of resCodes) {
        multi.del(`idrn:center:resource:${code}:${resCode}`);
      }
      multi.del(`idrn:center:resources:${code}`);
    }
    multi.del('idrn:centers');
    
    // Add new data
    for (const centerCode of Object.keys(centerMap)) {
      multi.sAdd('idrn:centers', centerCode);
      
      const center = centerMap[centerCode];
      let criticalCount = 0;
      let scoreWeight = 0;
      
      for (const res of center.resources) {
        multi.sAdd(`idrn:center:resources:${centerCode}`, res.item_code);
        multi.hSet(`idrn:center:resource:${centerCode}:${res.item_code}`, {
          name: res.name,
          category: res.category,
          unit: res.unit,
          available_qty: String(res.available_qty),
          min_threshold: String(res.min_threshold),
          status: res.status,
          last_updated: res.last_updated
        });
        
        if (res.available_qty < res.min_threshold) criticalCount++;
        scoreWeight += Math.min(res.available_qty / (res.min_threshold || 1), 1.0);
      }
      
      const healthScore = center.resources.length > 0 ? Math.round((scoreWeight / center.resources.length) * 100) : 100;
      center.metadata.critical_count = String(criticalCount);
      center.metadata.health_score = String(healthScore);
      
      multi.hSet(`idrn:center:metadata:${centerCode}`, center.metadata);
    }
    
    await multi.exec();
    console.log('[CACHE WARMUP] Successfully rebuilt entire Redis cache from PostgreSQL.');
  } catch (err) {
    console.error('[CACHE WARMUP] Failed to rebuild Redis cache from PostgreSQL:', err.message);
  }
}

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
            return false;
          }
          return Math.min(retries * 500, 2000);
        }
      }
    });

    redisClient.on('error', (err) => {
      console.warn('Redis Client connection error. Error:', err.message);
      isRedisConnected = false;
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully.');
      isRedisConnected = true;
      warmUpCache().catch(err => console.error(err));
    });

    await redisClient.connect();
  } catch (error) {
    console.warn('Could not establish Redis connection:', error.message);
    isRedisConnected = false;
  }
}

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

  const cached = localCache.get(key);
  if (cached) {
    if (Date.now() < cached.expiry) {
      return cached.value;
    }
    localCache.delete(key);
  }
  return null;
}

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
