const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const apiRateLimiter = require('../services/rateLimiter');

// Apply rate limiting to all inventory transactional operations
router.use(apiRateLimiter);

// Adjust inventory items (increase, reduction, replenishment, consumption)
router.post('/adjust', inventoryController.adjustInventory);

// Atomic transfer of inventory resources between storage centers
router.post('/transfer', inventoryController.transferInventory);

// Simulate sudden disaster consumption spikes
router.post('/spike', inventoryController.triggerEmergencySpike);

// Detect and list all resource shortages across all districts
router.get('/shortages', inventoryController.getShortages);

// Query full live operational status of the inventory database
router.get('/status', inventoryController.getAllInventory);

// Query recent movements/history of the inventory database
router.get('/movements', inventoryController.getMovements);

module.exports = router;

