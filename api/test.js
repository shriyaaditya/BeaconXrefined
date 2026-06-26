require('dotenv').config();
const cacheService = require('./services/cacheService');

async function testConnection() {
  console.log('Initializing cache connection test...');
  await cacheService.initCache();
  
  const isConnected = cacheService.getIsRedisConnected();
  if (isConnected) {
    console.log('SUCCESS: Connection to Redis was established successfully!');
    
    // Perform a quick set and get to verify read/write
    console.log('Writing test key "test_conn_key" to cache...');
    await cacheService.set('test_conn_key', { status: 'ok', time: new Date().toISOString() }, 10);
    
    console.log('Reading test key "test_conn_key" from cache...');
    const result = await cacheService.get('test_conn_key');
    console.log('Result read from Redis:', result);
    
    if (result && result.status === 'ok') {
      console.log('Verification successful! Redis cache read/write is working.');
    } else {
      console.log('Verification failed! Could not read correct value.');
    }
  } else {
    console.log('FAILED: Could not establish connection to Redis. See logs above.');
  }
  
  // Since node-redis keeps the event loop alive, we exit explicitly
  process.exit(0);
}

testConnection().catch(err => {
  console.error('Test script encountered an error:', err);
  process.exit(1);
});
