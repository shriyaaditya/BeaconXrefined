const express = require('express');
const router = express.Router();
const simulatorService = require('../services/simulatorService');

// Retrieve active state
router.get('/status', (req, res) => {
  return res.status(200).json({
    status: 'success',
    data: simulatorService.getStatus()
  });
});

// Configure modes
router.post('/configure', (req, res) => {
  const { mode, intervalSeconds, scenario } = req.body;

  if (!mode || !['static', 'simulation', 'scenario'].includes(mode)) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid mode. Mode must be static, simulation, or scenario.'
    });
  }

  const interval = parseInt(intervalSeconds, 10) || 10;
  if (interval < 1 || interval > 300) {
    return res.status(400).json({
      status: 'error',
      message: 'Interval must be between 1 and 300 seconds.'
    });
  }

  const activeScenario = scenario || 'none';
  if (mode === 'scenario' && !['flood', 'cyclone', 'earthquake'].includes(activeScenario)) {
    return res.status(400).json({
      status: 'error',
      message: 'Scenario must be flood, cyclone, or earthquake when in scenario mode.'
    });
  }

  simulatorService.configure(mode, interval, activeScenario);

  return res.status(200).json({
    status: 'success',
    message: 'Simulator successfully reconfigured.',
    data: simulatorService.getStatus()
  });
});

// Trigger a manual mock gateway event
router.post('/trigger', async (req, res) => {
  const { endpoint, payload } = req.body;

  if (!endpoint || !payload) {
    return res.status(400).json({
      status: 'error',
      message: 'Missing endpoint or payload parameters.'
    });
  }

  try {
    await simulatorService.triggerManualEvent(endpoint, payload);
    return res.status(200).json({
      status: 'success',
      message: 'Manual gateway event triggered and queued successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      status: 'error',
      message: err.message
    });
  }
});

module.exports = router;
