const inventoryService = require('../services/inventoryService');

/**
 * Controller to handle manual/automatic inventory adjustments (increase/decrease/replenish/consume)
 */
async function adjustInventory(req, res) {
  const { centerId, itemCode, quantityChange, type } = req.body;

  if (!centerId || !itemCode || quantityChange === undefined) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required parameters: centerId, itemCode, and quantityChange are required.'
    });
  }

  const change = parseInt(quantityChange, 10);
  if (isNaN(change)) {
    return res.status(400).json({
      status: 'error',
      message: 'quantityChange must be an integer.'
    });
  }

  try {
    const updatedResource = await inventoryService.adjustInventory(centerId, itemCode, change, type);
    return res.status(200).json({
      status: 'success',
      message: `Inventory successfully adjusted for item ${itemCode} in center ${centerId}.`,
      data: updatedResource
    });
  } catch (error) {
    console.error('adjustInventory Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Controller to handle transferring resources between centers
 */
async function transferInventory(req, res) {
  const { sourceCenterId, targetCenterId, itemCode, quantity } = req.body;

  if (!sourceCenterId || !targetCenterId || !itemCode || !quantity) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing required parameters: sourceCenterId, targetCenterId, itemCode, and quantity are required.'
    });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({
      status: 'error',
      message: 'quantity must be a positive integer.'
    });
  }

  try {
    const transferResult = await inventoryService.transferInventory(sourceCenterId, targetCenterId, itemCode, qty);
    return res.status(200).json({
      status: 'success',
      message: `Successfully transferred ${qty} of ${itemCode} from ${sourceCenterId} to ${targetCenterId}.`,
      data: transferResult
    });
  } catch (error) {
    console.error('transferInventory Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Controller to fetch all resources under critical thresholds
 */
async function getShortages(req, res) {
  try {
    const shortages = await inventoryService.checkShortages();
    return res.status(200).json({
      status: 'success',
      count: shortages.length,
      data: shortages
    });
  } catch (error) {
    console.error('getShortages Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve inventory shortages.'
    });
  }
}

/**
 * Controller to fetch all centers and their current inventory (dynamic live view)
 */
async function getAllInventory(req, res) {
  try {
    const data = await inventoryService.getAllCenters();
    return res.status(200).json({
      status: 'success',
      source: 'live_database',
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('getAllInventory Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve full inventory.'
    });
  }
}

/**
 * Controller to simulate a sudden disaster consumption event
 */
async function triggerEmergencySpike(req, res) {
  const { centerId, itemCode, percentSpike } = req.body;

  if (!centerId || !itemCode) {
    return res.status(400).json({
      status: 'error',
      message: 'centerId and itemCode are required parameters.'
    });
  }

  const spikeRate = percentSpike !== undefined ? parseFloat(percentSpike) : 0.50; // default 50% drawdown
  if (isNaN(spikeRate) || spikeRate <= 0 || spikeRate >= 1) {
    return res.status(400).json({
      status: 'error',
      message: 'percentSpike must be a decimal between 0 and 1 (exclusive).'
    });
  }

  try {
    const updatedResource = await inventoryService.simulateEmergencySpike(centerId, itemCode, spikeRate);
    return res.status(200).json({
      status: 'success',
      message: `Emergency consumption spike simulated successfully for item ${itemCode} in center ${centerId}.`,
      data: updatedResource
    });
  } catch (error) {
    console.error('triggerEmergencySpike Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
}

/**
 * Controller to fetch recent inventory movements
 */
async function getMovements(req, res) {
  try {
    const movements = await inventoryService.getRecentMovements();
    return res.status(200).json({
      status: 'success',
      count: movements.length,
      data: movements
    });
  } catch (error) {
    console.error('getMovements Controller Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve recent inventory movements.'
    });
  }
}

module.exports = {
  adjustInventory,
  transferInventory,
  getShortages,
  getAllInventory,
  triggerEmergencySpike,
  getMovements
};

