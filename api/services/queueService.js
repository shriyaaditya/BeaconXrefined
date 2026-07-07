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
          // Rollback handled internally by inventoryService. Requeue message to allow retry.
          amqpChannel.nack(msg, false, true);
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
  
  // 2. Adjust Inventory (Handles Postgres transaction, Redis cache, and mock_movements internally)
  const updatedResState = await inventoryService.adjustInventory(centerCode, resourceCode, changeVal, pgAction);
  console.log(`[QUEUE] Inventory adjusted successfully via inventoryService.`);
  
  // 3. Emit Event via Socket.IO
  if (ioInstance && updatedResState && updatedResState.redisSuccess) {
    const isLowStock = updatedResState.available_qty < updatedResState.min_threshold;
      
    ioInstance.emit('inventory-updated', {
      centerCode,
      resourceCode,
      availableQty: updatedResState.available_qty,
      minThreshold: updatedResState.min_threshold,
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
