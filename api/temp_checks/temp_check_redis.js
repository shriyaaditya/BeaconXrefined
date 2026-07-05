const redis = require('../services/redisService');
async function check() {
  const centers = await redis.client.smembers('idrn:centers');
  if (centers.length > 0) {
    const center = centers[0];
    const resources = await redis.client.smembers(`idrn:center:resources:${center}`);
    if (resources.length > 0) {
      const res = await redis.hgetAll(`idrn:center:resource:${center}:${resources[0]}`);
      console.log('Resource:', res);
    }
  }
  process.exit(0);
}
check();
