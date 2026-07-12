const express = require('express');
const router = express.Router();
const syncIdrnController = require('../controllers/syncsyncIdrnController');
const apiRateLimiter = require('../services/rateLimiter');

// Rate limited endpoint mapping for retrieving resources
router.get('/resources', apiRateLimiter, syncIdrnController.getIdrnResources);

module.exports = router;

// API endpoint to communicate with our backend. his route is mounted at /api/idrn