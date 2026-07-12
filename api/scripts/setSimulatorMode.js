const simulatorService = require('../services/simulatorService');
require('dotenv').config();

// Usage: node scripts/setSimulatorMode.js <mode> <intervalSeconds>
// mode: static | simulation
// intervalSeconds: integer (seconds)

async function main() {
  const [, , modeArg, intervalArg] = process.argv;
  if (!modeArg) {
    console.error('Missing mode argument.');
    console.error('Usage: node scripts/setSimulatorMode.js <mode> <intervalSeconds>');
    process.exit(1);
  }

  const mode = modeArg;
  const intervalSeconds = parseInt(intervalArg, 10) || 10;

  try {
    // Simulator configure is synchronous, but we wrap in async for consistency
    simulatorService.configure(mode, intervalSeconds);
    console.log('✅ Simulator reconfigured:', { mode, intervalSeconds });
  } catch (err) {
    console.error('❌ Failed to reconfigure simulator:', err.message);
    process.exit(1);
  }
}

main();
