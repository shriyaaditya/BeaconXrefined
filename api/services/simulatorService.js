const amqp = require('amqplib');
const inventoryService = require('./inventoryService');

let mode = 'static'; // 'static' | 'simulation' | 'scenario'
let intervalSeconds = 10;
let scenario = 'none'; // 'none' | 'flood' | 'cyclone' | 'earthquake'
let timer = null;

let amqpConnection = null;
let amqpChannel = null;

// Categories mapped to target scenario items for scenario triggers
const SCENARIO_ITEMS = {
  flood: {
    districts: ['Mumbai Suburban', 'Thane', 'Raigad', 'Ratnagiri'],
    items: ['IDRN-RE-001', 'IDRN-RE-003', 'IDRN-FOD-501', 'IDRN-WAT-302']
  },
  cyclone: {
    districts: ['Ratnagiri', 'Raigad', 'Thane'],
    items: ['IDRN-SHT-402', 'IDRN-GEN-601', 'IDRN-LGT-201', 'IDRN-COM-701']
  },
  earthquake: {
    districts: ['Pune', 'Thane', 'Mumbai Suburban', 'Raigad'],
    items: ['IDRN-MED-101', 'IDRN-SHT-401', 'IDRN-MED-103', 'IDRN-GEN-602']
  }
};

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
    } else if (mode === 'scenario') {
      await executeScenarioEvent(centers);
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
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: qty,
      actionType: 'restock',
      notes: `Truck Arrival: Delivers +${qty} units of ${resource.name} to ${center.center_name}`
    });
  } else if (roll < 0.80) {
    // 40% chance of Emergency Dispatch (- stock)
    const qty = Math.floor(Math.random() * 20) + 2; // 2 to 22
    await publishToQueue({
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

    // Publish two separate leg updates to the queue
    await publishToQueue({
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: -transferQty,
      actionType: 'transfer_out',
      notes: `Transfer: Moving ${transferQty} units of ${resource.name} to ${targetCenter.center_name}`
    });
    await publishToQueue({
      centerCode: targetCenter.center_id,
      resourceCode: resource.item_code,
      quantityChange: transferQty,
      actionType: 'transfer_in',
      notes: `Transfer: Receiving ${transferQty} units of ${resource.name} from ${center.center_name}`
    });
  } else {
    // 5% chance of sudden drawdown spike
    const pct = parseFloat((0.2 + Math.random() * 0.4).toFixed(2)); // 20% to 60%
    const drawdown = Math.round(resource.available_qty * pct);
    const actualReduction = drawdown > 0 ? -drawdown : (resource.available_qty > 0 ? -1 : 0);
    await publishToQueue({
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: actualReduction,
      actionType: 'dispatch',
      notes: `Spike Alert: Sudden ${Math.round(pct * 100)}% drawdown on ${resource.name} at ${center.center_name}`
    });
  }
}

/**
 * Execute disaster curves (Scenario Mode)
 */
async function executeScenarioEvent(centers) {
  const config = SCENARIO_ITEMS[scenario];
  if (!config) return;

  // Filter centers in vulnerable districts
  const targetCenters = centers.filter(c => config.districts.includes(c.district));
  if (targetCenters.length === 0) return;

  const center = selectRandom(targetCenters);
  
  // Find scenario items inside the center's resources
  const items = center.resources.filter(r => config.items.includes(r.item_code));
  if (items.length === 0) return;

  const resource = selectRandom(items);
  
  // Scenarios are consumption heavy to model emergency surges
  const roll = Math.random();

  if (roll < 0.75) {
    // 75% chance of severe emergency surge dispatches
    const drawDownRate = parseFloat((0.35 + Math.random() * 0.35).toFixed(2)); // 35% to 70% drawdown
    const drawdown = Math.round(resource.available_qty * drawDownRate);
    const actualReduction = drawdown > 0 ? -drawdown : (resource.available_qty > 0 ? -1 : 0);
    await publishToQueue({
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: actualReduction,
      actionType: 'dispatch',
      notes: `${scenario.toUpperCase()} DISASTER ONSET: Drawdown ${Math.round(drawDownRate * 100)}% on ${resource.name} at ${center.center_name}`
    });
  } else if (roll < 0.90) {
    // 15% chance of critical supply transfer into the disaster zone
    const sourceCenters = centers.filter(c => !config.districts.includes(c.district));
    if (sourceCenters.length === 0) return;

    const sourceCenter = selectRandom(sourceCenters);
    const sourceRes = sourceCenter.resources.find(r => r.item_code === resource.item_code);
    if (!sourceRes || sourceRes.available_qty < 5) return;

    const transferQty = Math.min(15, Math.floor(sourceRes.available_qty / 2));
    if (transferQty === 0) return;

    await publishToQueue({
      centerCode: sourceCenter.center_id,
      resourceCode: resource.item_code,
      quantityChange: -transferQty,
      actionType: 'transfer_out',
      notes: `Emergency Relief Dispatch: Relocating ${transferQty} units of ${resource.name} to emergency zone ${center.center_name}`
    });
    await publishToQueue({
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: transferQty,
      actionType: 'transfer_in',
      notes: `Emergency Relief Dispatch: Receiving ${transferQty} units of ${resource.name} from fallback center ${sourceCenter.center_name}`
    });
  } else {
    // 10% chance of critical emergency replenishment airlift
    const qty = Math.floor(Math.random() * 60) + 20; // 20 to 80 units airlifted in
    await publishToQueue({
      centerCode: center.center_id,
      resourceCode: resource.item_code,
      quantityChange: qty,
      actionType: 'restock',
      notes: `Emergency Airlift: Dropping +${qty} units of ${resource.name} to ${center.center_name}`
    });
  }
}

function selectRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Configure simulator properties
 */
function configure(newMode, newInterval, newScenario = 'none') {
  console.log(`[SIMULATOR] Reconfiguring: mode=${newMode}, interval=${newInterval}s, scenario=${newScenario}`);
  
  mode = newMode;
  intervalSeconds = parseInt(newInterval, 10) || 10;
  scenario = newScenario;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (mode === 'simulation' || mode === 'scenario') {
    timer = setInterval(runStep, intervalSeconds * 1000);
    // Trigger immediate run on configure
    runStep();
  }
}

module.exports = {
  getStatus: () => ({ mode, intervalSeconds, scenario }),
  configure,
  triggerManualEvent: async (endpoint, payload) => {
    console.log('[SIMULATOR] Manually triggering event:', endpoint, payload);
    
    if (endpoint === '/adjust') {
      const change = parseInt(payload.quantityChange, 10) || 0;
      const isReplenish = payload.type === 'replenish' || change > 0;
      await publishToQueue({
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
        centerCode: payload.centerId,
        resourceCode: payload.itemCode,
        quantityChange: actualReduction,
        actionType: 'dispatch',
        notes: `Manual disaster spike: -${Math.abs(actualReduction)} units (${Math.round(spikeRate * 100)}% drawdown)`
      });
    } else if (endpoint === '/transfer') {
      const qty = parseInt(payload.quantity, 10) || 0;
      await publishToQueue({
        centerCode: payload.sourceCenterId,
        resourceCode: payload.itemCode,
        quantityChange: -qty,
        actionType: 'transfer_out',
        notes: `Manual transfer to ${payload.targetCenterId}`
      });
      await publishToQueue({
        centerCode: payload.targetCenterId,
        resourceCode: payload.itemCode,
        quantityChange: qty,
        actionType: 'transfer_in',
        notes: `Manual transfer from ${payload.sourceCenterId}`
      });
    }
  }
};

