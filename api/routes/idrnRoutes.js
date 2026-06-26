const express = require('express');
const router = express.Router();
const idrnController = require('../controllers/idrnController');
const apiRateLimiter = require('../services/rateLimiter');

// Rate limited endpoint mapping for retrieving resources
router.get('/resources', apiRateLimiter, idrnController.getIdrnResources);

module.exports = router;
