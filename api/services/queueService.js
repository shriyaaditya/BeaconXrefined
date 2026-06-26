const amqp = require('amqplib');
const dbService = require('./dbService');
const inventoryService = require('./inventoryService');

let amqpConnection = null;
let amqpChannel = null;
let ioInstance = null; // Socket.IO server reference

/**
 * Initialize RabbitMQ Connection and start consumer
 * @param {object} io - Socket.IO Server Instance
 */
async function initQueue(io) {
  ioInstance = io;
  try {
    const rabbitUrl = process.env.RABBITMQ_URL || 'amqp://localhost';
    console.log(`[QUEUE] Connecting to RabbitMQ at ${rabbitUrl}...`);
    amqpConnection = await amqp.connect(rabbitUrl);
    amqpChannel = await amqpConnection.createChannel();
    
    const queueName = 'inventory_updates';
    await amqpChannel.assertQueue(queueName, { durable: true });
    
    console.log(`[QUEUE] RabbitMQ connection established. Listening on queue: "${queueName}"`);
    
    // Start consuming messages
    amqpChannel.consume(queueName, async (msg) => {
      if (msg !== null) {
        try {
          const content = JSON.parse(msg.content.toString());
          console.log('[QUEUE] Received inventory update message:', content);
          
          await processInventoryUpdate(content);
          
          amqpChannel.ack(msg);
        } catch (err) {
          console.error('[QUEUE] Failed processing message:', err.message);
          // Requeue or discard? Discard for simplicity, or nack with requeue=false
          amqpChannel.nack(msg, false, false);
        }
      }
    });
    
  } catch (err) {
    console.error('[QUEUE FATAL] Failed to initialize RabbitMQ consumer:', err.message);
    // Do not crash, but retry later or log
  }
}

/**
 * Process a single inventory update message
 */
async function processInventoryUpdate(payload) {
  const { centerCode, resourceCode, quantityChange, actionType, notes } = payload;
  
  // 1. Validation
  if (!centerCode || !resourceCode || quantityChange === undefined || !actionType) {
    throw new Error('Invalid message payload: missing required fields.');
  }
  
  const changeVal = parseInt(quantityChange, 10);
  if (isNaN(changeVal)) {
    throw new Error('Invalid message payload: quantityChange must be an integer.');
  }
  
  // Map actionType to valid PostgreSQL transaction_action enum
  const validActions = ['restock', 'dispatch', 'transfer_in', 'transfer_out', 'correction'];
  const pgAction = validActions.includes(actionType) ? actionType : 'correction';

  console.log(`[QUEUE] Processing: Center=${centerCode}, Resource=${resourceCode}, Change=${changeVal}, Action=${pgAction}`);
  
  // 2. Resolve UUIDs from PostgreSQL
  let centerUuid = null;
  let resourceUuid = null;
  
  const centerRes = await dbService.query('SELECT id FROM centers WHERE center_code = $1', [centerCode]);
  if (centerRes.rows.length === 0) {
    throw new Error(`Center code "${centerCode}" not found in PostgreSQL database.`);
  }
  centerUuid = centerRes.rows[0].id;
  
  const resourceRes = await dbService.query('SELECT id FROM resources WHERE resource_code = $1', [resourceCode]);
  if (resourceRes.rows.length === 0) {
    throw new Error(`Resource code "${resourceCode}" not found in PostgreSQL database.`);
  }
  resourceUuid = resourceRes.rows[0].id;
  
  // 3. PostgreSQL Transaction
  const pgClient = await dbService.pool.connect();
  let dbQty = 0;
  let dbMinThreshold = 0;
  
  try {
    await pgClient.query('BEGIN');
    
    // Retrieve or insert inventory row
    const invSelect = await pgClient.query(
      'SELECT available_qty, min_threshold FROM inventory WHERE center_id = $1 AND resource_id = $2',
      [centerUuid, resourceUuid]
    );
    
    if (invSelect.rows.length > 0) {
      dbMinThreshold = invSelect.rows[0].min_threshold;
      const currentQty = invSelect.rows[0].available_qty;
      dbQty = Math.max(0, currentQty + changeVal);
      
      await pgClient.query(
        'UPDATE inventory SET available_qty = $1, updated_at = CURRENT_TIMESTAMP WHERE center_id = $2 AND resource_id = $3',
        [dbQty, centerUuid, resourceUuid]
      );
    } else {
      dbQty = Math.max(0, changeVal);
      dbMinThreshold = 0; // default for new rows
      
      await pgClient.query(
        'INSERT INTO inventory (center_id, resource_id, available_qty, min_threshold) VALUES ($1, $2, $3, $4)',
        [centerUuid, resourceUuid, dbQty, dbMinThreshold]
      );
    }
    
    // Insert Transaction history row
    await pgClient.query(
      `INSERT INTO inventory_transactions (center_id, resource_id, quantity_change, action_type, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        centerUuid,
        resourceUuid,
        changeVal,
        pgAction,
        notes || `Queue update via ${actionType}`,
        '00000000-0000-0000-0000-000000000001' // System admin user ID from seed
      ]
    );
    
    await pgClient.query('COMMIT');
    console.log(`[QUEUE PG] PostgreSQL inventory updated successfully. New quantity: ${dbQty}`);
  } catch (err) {
    await pgClient.query('ROLLBACK');
    console.error('[QUEUE PG ERROR] PostgreSQL transaction rolled back:', err.message);
    throw err;
  } finally {
    pgClient.release();
  }
  
  // 4. Update Redis & Local File cache (via inventoryService)
  let updatedResState = null;
  try {
    updatedResState = await inventoryService.adjustInventory(centerCode, resourceCode, changeVal, pgAction);
    console.log(`[QUEUE REDIS] Redis state adjusted successfully.`);
  } catch (err) {
    console.error('[QUEUE REDIS ERROR] Failed to adjust Redis/Local File Cache:', err.message);
    // We continue since PostgreSQL was updated and matches source of truth
  }
  
  // 5. Emit Event via Socket.IO
  if (ioInstance) {
    const isLowStock = updatedResState 
      ? updatedResState.available_qty < updatedResState.min_threshold 
      : dbQty < dbMinThreshold;
      
    ioInstance.emit('inventory-updated', {
      centerCode,
      resourceCode,
      availableQty: updatedResState ? updatedResState.available_qty : dbQty,
      minThreshold: updatedResState ? updatedResState.min_threshold : dbMinThreshold,
      quantityChange: changeVal,
      actionType,
      isLowStock,
      timestamp: new Date().toISOString()
    });
    console.log(`[QUEUE IO] Socket.IO "inventory-updated" event broadcasted.`);
  }
}

module.exports = {
  initQueue,
  getAmqpInfo: () => ({ connection: amqpConnection, channel: amqpChannel })
};
