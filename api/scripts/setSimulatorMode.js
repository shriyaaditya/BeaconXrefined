const simulatorService = require('../services/simulatorService');
require('dotenv').config();

// Usage: node scripts/setSimulatorMode.js <mode> <intervalSeconds> [scenario]
// mode: static | simulation | scenario
// intervalSeconds: integer (seconds)
// scenario (optional): flood | cyclone | earthquake (only for scenario mode)

async function main() {
  const [, , modeArg, intervalArg, scenarioArg] = process.argv;
  if (!modeArg) {
    console.error('Missing mode argument.');
    console.error('Usage: node scripts/setSimulatorMode.js <mode> <intervalSeconds> [scenario]');
    process.exit(1);
  }

  const mode = modeArg;
  const intervalSeconds = parseInt(intervalArg, 10) || 10;
  const scenario = scenarioArg || 'none';

  try {
    // Simulator configure is synchronous, but we wrap in async for consistency
    simulatorService.configure(mode, intervalSeconds, scenario);
    console.log('✅ Simulator reconfigured:', { mode, intervalSeconds, scenario });
  } catch (err) {
    console.error('❌ Failed to reconfigure simulator:', err.message);
    process.exit(1);
  }
}

main();
