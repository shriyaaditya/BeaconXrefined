const amqp = require('amqplib');
const inventoryService = require('./inventoryService');

let mode = 'static'; // 'static' | 'simulation'
let intervalSeconds = 10;
let timer = null;

let amqpConnection = null;
let amqpChannel = null;

/**
 * Establish or reuse RabbitMQ channel
 */
async function getAmqpChannel() {
  if (amqpChannel) return amqpChannel;
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    amqpConnection = await amqp.connect(rabbitUrl);
    amqpChannel = await amqpConnection.createChannel();
    await amqpChannel.assertQueue('inventory_updates', { durable: true });
    return amqpChannel;
  } catch (err) {
    console.error('[SIMULATOR] RabbitMQ connection failed:', err.message);
    throw err;
  }
}

/**
 * Publish inventory update message to RabbitMQ queue
 */
async function publishToQueue(message) {
  try {
    const channel = await getAmqpChannel();
    channel.sendToQueue('inventory_updates', Buffer.from(JSON.stringify(message)), {
      persistent: true
    });
    console.log('[SIMULATOR RMQ] Message published to queue:', message);
  } catch (err) {
    console.error('[SIMULATOR RMQ] Failed to publish message:', err.message);
  }
}

/**
 * Main simulation runner
 */
async function runStep() {
  try {
    const centers = await inventoryService.getAllCenters();
    if (!centers || centers.length === 0) return;

    if (mode === 'simulation') {
      await executeRandomEvent(centers);
    }
  } catch (err) {
    console.error('[SIMULATOR ERROR] Failed running simulator step:', err.message);
  }
}

/**
 * Automate random updates (Simulation Mode)
 */
async function executeRandomEvent(centers) {
  // Select random center
  const center = selectRandom(centers);
  const resource = selectRandom(center.resources);
  if (!resource) return;

  const roll = Math.random();

  if (roll < 0.40) {
    // 40% chance of Truck Arrival / Replenishment (+ stock)
    const qty = Math.floor(Math.random() * 45) + 5; // 5 to 50
    await publishToQueue({
      eventType: 'inventory_adjustment',
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: qty,
      actionType: 'restock',
      notes: `Truck Arrival: Delivers +${qty} units of ${resource.name} to ${center.center_name}`
    });
  } else if (roll < 0.80) {
    // 40% chance of Emergency Dispatch (- stock)
    const qty = Math.floor(Math.random() * 30) + 2; // 2 to 32
    await publishToQueue({
      eventType: 'inventory_adjustment',
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: -qty,
      actionType: 'dispatch',
      notes: `Dispatch: Dispatches -${qty} units of ${resource.name} from ${center.center_name}`
    });
  } else if (roll < 0.95) {
    // 15% chance of Inter-warehouse Transfer
    const otherCenters = centers.filter(c => c.center_id !== center.center_id);
    if (otherCenters.length === 0) return;
    const targetCenter = selectRandom(otherCenters);
    const qty = Math.floor(Math.random() * 10) + 1; // 1 to 10

    // Ensure source actually has enough stock to transfer
    const srcQty = resource.available_qty;
    const transferQty = Math.min(qty, srcQty);
    if (transferQty === 0) return;

    // Publish a single atomic transfer event to the queue
    await publishToQueue({
      eventType: 'inventory_transfer',
      sourceCenterCode: center.center_id,
      targetCenterCode: targetCenter.center_id,
      resourceCode: resource.item_code,
      quantity: transferQty,
      notes: `Transfer: Moving ${transferQty} units of ${resource.name} to ${targetCenter.center_name}`
    });
  } else {
    // 5% chance of sudden drawdown spike
    const pct = parseFloat((0.2 + Math.random() * 0.4).toFixed(2)); // 20% to 60%
    const drawdown = Math.round(resource.available_qty * pct);
    const actualReduction = drawdown > 0 ? -drawdown : (resource.available_qty > 0 ? -1 : 0);
    await publishToQueue({
      eventType: 'inventory_adjustment',
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: actualReduction,
      actionType: 'dispatch',
      notes: `Spike Alert: Sudden ${Math.round(pct * 100)}% drawdown on ${resource.name} at ${center.center_name}`
    });
  }
}

function selectRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Configure simulator properties
 */
function configure(newMode, newInterval) {
  console.log(`[SIMULATOR] Reconfiguring: mode=${newMode}, interval=${newInterval}s`);

  mode = newMode;
  intervalSeconds = parseInt(newInterval, 10) || 10;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (mode === 'simulation') {
    timer = setInterval(runStep, intervalSeconds * 1000);
    // Trigger immediate run on configure
    runStep();
  }
}

module.exports = {
  getStatus: () => ({ mode, intervalSeconds }),
  configure,
  triggerManualEvent: async (endpoint, payload) => {
    console.log('[SIMULATOR] Manually triggering event:', endpoint, payload);

    if (endpoint === '/adjust') {
      const change = parseInt(payload.quantityChange, 10) || 0;
      const isReplenish = payload.type === 'replenish' || change > 0;
      await publishToQueue({
        eventType: 'inventory_adjustment',
        centerCode: payload.centerId,
        resourceCode: payload.itemCode,
        quantityChange: change,
        actionType: isReplenish ? 'restock' : 'dispatch',
        notes: `Manual adjustment: ${isReplenish ? 'Replenish' : 'Consumption'}`
      });
    } else if (endpoint === '/spike') {
      const centers = await inventoryService.getAllCenters();
      const center = centers.find(c => c.center_id === payload.centerId);
      const resObj = center ? center.resources.find(r => r.item_code === payload.itemCode) : null;
      const currentQty = resObj ? resObj.available_qty : 0;
      const spikeRate = payload.percentSpike !== undefined ? parseFloat(payload.percentSpike) : 0.50;
      const drawdown = Math.round(currentQty * spikeRate);
      const actualReduction = drawdown > 0 ? -drawdown : (currentQty > 0 ? -1 : 0);

      await publishToQueue({
        eventType: 'inventory_adjustment',
        centerCode: payload.centerId,
        resourceCode: payload.itemCode,
        quantityChange: actualReduction,
        actionType: 'dispatch',
        notes: `Manual disaster spike: -${Math.abs(actualReduction)} units (${Math.round(spikeRate * 100)}% drawdown)`
      });
    } else if (endpoint === '/transfer') {
      const qty = parseInt(payload.quantity, 10) || 0;
      await publishToQueue({
        eventType: 'inventory_transfer',
        sourceCenterCode: payload.sourceCenterId,
        targetCenterCode: payload.targetCenterId,
        resourceCode: payload.itemCode,
        quantity: qty,
        notes: `Manual transfer from ${payload.sourceCenterId} to ${payload.targetCenterId}`
      });
    }
  }
};

