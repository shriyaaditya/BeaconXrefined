const cacheService = require('./cacheService');
const dbService = require('./dbService');
const queueService = require('./queueService');

let ioInstance = null;
let intervalId = null;

const metrics = {
  published: 0,
  processed: 0,
  failed: 0,
};

function initMonitor(io) {
  ioInstance = io;

  // Intercept console.log and console.error
  const originalLog = console.log;
  const originalError = console.error;

  console.log = function (...args) {
    processLogMessage('info', args);
    originalLog.apply(console, args);
  };

  console.error = function (...args) {
    processLogMessage('error', args);
    originalError.apply(console, args);
  };

  // Start emitting metrics every 2 seconds
  intervalId = setInterval(broadcastMetrics, 2000);
  console.log('[SYSTEM MONITOR] Initialized and broadcasting metrics');
}

function processLogMessage(level, args) {
  if (!ioInstance) return;
  if (!args || args.length === 0) return;

  const msg = typeof args[0] === 'string' ? args[0] : '';
  let service = 'Unknown';
  let event = args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');

  // Look for tags
  if (msg.startsWith('[SIMULATOR RMQ]')) {
    service = 'Simulator';
    event = event.replace('[SIMULATOR RMQ]', '').trim();
    metrics.published++;
  } else if (msg.startsWith('[SIMULATOR]')) {
    service = 'Simulator';
    event = event.replace('[SIMULATOR]', '').trim();
  } else if (msg.startsWith('[QUEUE PG ERROR]')) {
    service = 'PostgreSQL';
    event = event.replace('[QUEUE PG ERROR]', '').trim();
    metrics.failed++;
  } else if (msg.startsWith('[QUEUE PG]')) {
    service = 'PostgreSQL';
    event = event.replace('[QUEUE PG]', '').trim();
  } else if (msg.startsWith('[QUEUE REDIS ERROR]')) {
    service = 'Redis';
    event = event.replace('[QUEUE REDIS ERROR]', '').trim();
  } else if (msg.startsWith('[QUEUE REDIS]')) {
    service = 'Redis';
    event = event.replace('[QUEUE REDIS]', '').trim();
  } else if (msg.startsWith('[QUEUE IO]')) {
    service = 'Socket.IO';
    event = event.replace('[QUEUE IO]', '').trim();
  } else if (msg.startsWith('[QUEUE FATAL]')) {
    service = 'RabbitMQ';
    event = event.replace('[QUEUE FATAL]', '').trim();
    metrics.failed++;
  } else if (msg.startsWith('[QUEUE]')) {
    service = 'RabbitMQ';
    event = event.replace('[QUEUE]', '').trim();
    if (event.includes('Processing:')) {
      metrics.processed++;
    } else if (event.includes('Failed processing')) {
      metrics.failed++;
    }
  } else {
    // Not a pipeline log we want to broadcast
    return;
  }

  const logPayload = {
    timestamp: new Date().toISOString(),
    service,
    event,
    status: level === 'error' ? 'error' : 'success',
  };

  ioInstance.emit('system-log', logPayload);
}

async function broadcastMetrics() {
  if (!ioInstance) return;

  // Check Postgres
  let postgresConnected = false;
  try {
    const res = await dbService.query('SELECT 1');
    if (res && res.rowCount === 1) postgresConnected = true;
  } catch (err) {
    postgresConnected = false;
  }

  // Check Redis
  const redisConnected = cacheService.getIsRedisConnected();

  // Check RabbitMQ and Queue Size
  let rabbitmqConnected = false;
  let consumerStatus = false;
  let queueSize = 0;

  const amqpInfo = queueService.getAmqpInfo();
  if (amqpInfo && amqpInfo.connection && amqpInfo.channel) {
    rabbitmqConnected = true;
    try {
      const qStatus = await amqpInfo.channel.checkQueue('inventory_updates');
      queueSize = qStatus.messageCount || 0;
      consumerStatus = (qStatus.consumerCount || 0) > 0;
    } catch (err) {
      // Channel might be closed or queue doesn't exist
    }
  }

  // Active WebSockets
  const activeSockets = ioInstance.engine ? ioInstance.engine.clientsCount : 0;

  const metricPayload = {
    rabbitmqConnected,
    redisConnected,
    postgresConnected,
    consumerStatus,
    activeSockets,
    queueSize,
    messagesPublished: metrics.published,
    messagesProcessed: metrics.processed,
    messagesFailed: metrics.failed,
  };

  ioInstance.emit('system-metrics', metricPayload);
}

module.exports = {
  initMonitor,
};
