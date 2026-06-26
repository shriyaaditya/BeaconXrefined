const fs = require('fs').promises;
const path = require('path');
const cacheService = require('./cacheService');

const mockDataPath = path.join(__dirname, '../data/mock_idrn_data.json');

/**
 * Helper to check if Redis is active
 */
function isRedisActive() {
  return cacheService.getIsRedisConnected();
}

/**
 * Helper to parse integers safely
 */
function parseIntSafe(val, defaultVal = 0) {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Helper to parse float safely
 */
function parseFloatSafe(val, defaultVal = 0) {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
}

/**
 * Reads local JSON database file (used in fallback/offline mode)
 */
async function readLocalData() {
  try {
    const rawData = await fs.readFile(mockDataPath, 'utf8');
    return JSON.parse(rawData);
  } catch (err) {
    console.error('Failed to read local JSON data:', err.message);
    return [];
  }
}

/**
 * Writes local JSON database file (used in fallback/offline mode)
 */
async function writeLocalData(data) {
  try {
    await fs.writeFile(mockDataPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to write local JSON data:', err.message);
  }
}

/**
 * Fetches all centers and reconstructs their resource inventory
 * dynamically from granular Redis hashes (or local JSON fallback).
 */
async function getAllCenters() {
  let centers = [];
  if (!isRedisActive()) {
    console.log('Redis offline: Fetching inventory from local JSON database.');
    centers = await readLocalData();
  } else {
    try {
      const client = cacheService.getClient();
      const centerIds = await client.sMembers('idrn:centers');
      
      if (!centerIds || centerIds.length === 0) {
        console.log('No centers found in Redis. Falling back to local JSON data.');
        centers = await readLocalData();
      } else {
        // Parallel fetch of all centers
        const centersPromises = centerIds.map(centerId => getCenter(centerId));
        const resolved = await Promise.all(centersPromises);
        centers = resolved.filter(c => c !== null);
        // Sort centers by ID to keep output consistent
        centers.sort((a, b) => a.center_id.localeCompare(b.center_id));
      }
    } catch (err) {
      console.error('Failed to reconstruct inventory from Redis hashes:', err.message);
      centers = await readLocalData();
    }
  }

  // Calculate and attach dynamic readiness, burn rates, and runout predictions
  try {
    const movements = await getRecentMovements();
    centers = attachMetrics(centers, movements);
  } catch (err) {
    console.error('Failed to attach EOC operational metrics:', err.message);
  }

  return centers;
}

/**
 * Calculates burn rates, runout predictions, and readiness scores.
 */
function attachMetrics(centers, movements) {
  // Baseline burn rates by category (units/hour) to keep dashboard active
  const BASELINES = {
    'Rescue Equipment': 0.1,
    'Medical Supplies': 0.8,
    'Lighting & Power': 0.2,
    'Water & Sanitation': 1.5,
    'Shelter & Camps': 0.5,
    'Food & Survival': 4.0,
    'Communication': 0.1,
    'Emergency Vehicles': 0.05
  };

  return centers.map(center => {
    let scoreWeight = 0;
    const resources = center.resources.map(res => {
      // Find drawdowns in movements for this center and resource
      const relevantMovements = movements.filter(m => 
        m.center_id === center.center_id && 
        m.item_code === res.item_code && 
        (m.type === 'consume' || m.type === 'spike' || m.type === 'transfer')
      );

      // Sum drawdowns (quantities are negative for adjust/consume, positive for transfer out)
      let totalDrawdown = 0;
      relevantMovements.forEach(m => {
        if (m.type === 'transfer') {
          totalDrawdown += m.quantity; // transfers out are positive quantities
        } else {
          totalDrawdown += Math.abs(m.quantity); // drawdowns are negative
        }
      });

      // Compute dynamic burn rate (scaled over 12 hours)
      const dynamicBurn = totalDrawdown / 12; // units per hour
      const category = res.metadata.category || 'Default';
      const baseline = BASELINES[category] || 0.1;
      const burnRate = parseFloat((baseline + dynamicBurn).toFixed(2));

      // Calculate runout predictions
      let runoutHours = null;
      if (burnRate > 0) {
        runoutHours = parseFloat((res.available_qty / burnRate).toFixed(1));
      }

      // Calculate ratio for readiness score weight
      const threshold = res.min_threshold || 1;
      const ratio = res.available_qty / threshold;
      scoreWeight += Math.min(ratio, 1.0);

      return {
        ...res,
        burn_rate: burnRate,
        runout_hours: runoutHours
      };
    });

    const readinessScore = resources.length > 0
      ? Math.round((scoreWeight / resources.length) * 100)
      : 100;

    return {
      ...center,
      resources,
      readiness_score: readinessScore
    };
  });
}

/**
 * Reconstructs a single center's details and inventory from Redis hashes.
 */
async function getCenter(centerId) {
  if (!isRedisActive()) {
    const localData = await readLocalData();
    return localData.find(c => c.center_id === centerId) || null;
  }

  try {
    const client = cacheService.getClient();
    
    // Parallel fetch of metadata and item list
    const [metadata, itemCodes] = await Promise.all([
      client.hGetAll(`idrn:center:metadata:${centerId}`),
      client.sMembers(`idrn:center:resources:${centerId}`)
    ]);
    
    // If no metadata exists, this center does not exist
    if (!metadata || Object.keys(metadata).length === 0) {
      return null;
    }

    // Parallel fetch of all resource hashes
    const resourcePromises = itemCodes.map(async (itemCode) => {
      const resData = await client.hGetAll(`idrn:center:resource:${centerId}:${itemCode}`);
      if (!resData || Object.keys(resData).length === 0) return null;

      const availableQty = parseIntSafe(resData.available_qty);
      const minThreshold = parseIntSafe(resData.min_threshold);

      return {
        item_code: itemCode,
        name: resData.name,
        available_qty: availableQty,
        min_threshold: minThreshold,
        last_updated: resData.last_updated,
        metadata: {
          category: resData.category,
          unit: resData.unit,
          status: availableQty < minThreshold ? 'Critical' : 'Adequate'
        }
      };
    });

    const resolvedResources = await Promise.all(resourcePromises);
    const resources = resolvedResources.filter(r => r !== null);

    // Sort resources by item_code for consistency
    resources.sort((a, b) => a.item_code.localeCompare(b.item_code));

    return {
      center_id: centerId,
      center_name: metadata.name,
      latitude: parseFloatSafe(metadata.lat),
      longitude: parseFloatSafe(metadata.lng),
      district: metadata.district,
      region: metadata.region,
      resources,
      last_sync: metadata.last_sync
    };
  } catch (err) {
    console.error(`Error reconstructing center ${centerId} from Redis:`, err.message);
    return null;
  }
}

/**
 * Adjusts inventory quantities for a specific item in a center.
 * Handles both increases (+qty) and reductions (-qty).
 * Returns the updated resource state.
 */
async function adjustInventory(centerId, itemCode, quantityChange, type = 'adjust') {
  const changeVal = parseIntSafe(quantityChange);
  const timestamp = new Date().toISOString();

  if (isRedisActive()) {
    const client = cacheService.getClient();
    const resourceKey = `idrn:center:resource:${centerId}:${itemCode}`;

    // Verify resource exists
    const resData = await client.hGetAll(resourceKey);
    if (!resData || Object.keys(resData).length === 0) {
      throw new Error(`Resource "${itemCode}" does not exist in center "${centerId}".`);
    }

    const currentQty = parseIntSafe(resData.available_qty);
    const minThreshold = parseIntSafe(resData.min_threshold);
    
    let newQty = currentQty + changeVal;
    if (newQty < 0) newQty = 0;

    const newStatus = newQty < minThreshold ? 'Critical' : 'Adequate';

    // Atomic update of only target attributes
    await client.hSet(resourceKey, {
      available_qty: String(newQty),
      status: newStatus,
      last_updated: timestamp
    });

    // Update metadata sync timestamp
    await client.hSet(`idrn:center:metadata:${centerId}`, 'last_sync', timestamp);

    const metadata = await client.hGetAll(`idrn:center:metadata:${centerId}`);
    const centerName = metadata.name || centerId;

    await logMovement({
      id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp,
      center_id: centerId,
      center_name: centerName,
      item_code: itemCode,
      item_name: resData.name || itemCode,
      type,
      quantity: changeVal,
      details: `${type === 'replenish' ? 'Replenished' : type === 'spike' ? 'Emergency drawdown (disaster spike)' : 'Adjusted'} ${Math.abs(changeVal)} units of ${resData.name || itemCode} at ${centerName}.`
    });

    return {
      item_code: itemCode,
      name: resData.name,
      available_qty: newQty,
      min_threshold: minThreshold,
      last_updated: timestamp,
      metadata: {
        category: resData.category,
        unit: resData.unit,
        status: newStatus
      }
    };
  } else {
    // Offline local JSON file mode
    console.log('Redis offline: Adjusting inventory in local file database.');
    const localData = await readLocalData();
    const center = localData.find(c => c.center_id === centerId);
    if (!center) {
      throw new Error(`Center "${centerId}" does not exist in local database.`);
    }

    const resource = center.resources.find(r => r.item_code === itemCode);
    if (!resource) {
      throw new Error(`Resource "${itemCode}" does not exist in center "${centerId}".`);
    }

    let newQty = resource.available_qty + changeVal;
    if (newQty < 0) newQty = 0;

    resource.available_qty = newQty;
    resource.metadata.status = newQty < resource.min_threshold ? 'Critical' : 'Adequate';
    resource.last_updated = timestamp;
    center.last_sync = timestamp;

    await writeLocalData(localData);

    await logMovement({
      id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp,
      center_id: centerId,
      center_name: center.center_name,
      item_code: itemCode,
      item_name: resource.name,
      type,
      quantity: changeVal,
      details: `${type === 'replenish' ? 'Replenished' : type === 'spike' ? 'Emergency drawdown (disaster spike)' : 'Adjusted'} ${Math.abs(changeVal)} units of ${resource.name} at ${center.center_name}.`
    });

    return resource;
  }
}

/**
 * Atomically transfers a quantity of an item from a source center to a target center.
 * Checks for inventory availability before execution.
 */
async function transferInventory(sourceCenterId, targetCenterId, itemCode, quantity) {
  const qtyToTransfer = parseIntSafe(quantity);
  if (qtyToTransfer <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }

  const timestamp = new Date().toISOString();

  if (isRedisActive()) {
    const client = cacheService.getClient();

    const srcResKey = `idrn:center:resource:${sourceCenterId}:${itemCode}`;
    const destResKey = `idrn:center:resource:${targetCenterId}:${itemCode}`;

    // Read details
    const srcData = await client.hGetAll(srcResKey);
    const destData = await client.hGetAll(destResKey);

    if (!srcData || Object.keys(srcData).length === 0) {
      throw new Error(`Item "${itemCode}" does not exist in source center "${sourceCenterId}".`);
    }
    if (!destData || Object.keys(destData).length === 0) {
      throw new Error(`Item "${itemCode}" does not exist in target center "${targetCenterId}".`);
    }

    const srcQty = parseIntSafe(srcData.available_qty);
    if (srcQty < qtyToTransfer) {
      throw new Error(`Insufficient inventory at source: requested ${qtyToTransfer}, but only ${srcQty} available.`);
    }

    const destQty = parseIntSafe(destData.available_qty);

    const newSrcQty = srcQty - qtyToTransfer;
    const newDestQty = destQty + qtyToTransfer;

    const srcMin = parseIntSafe(srcData.min_threshold);
    const destMin = parseIntSafe(destData.min_threshold);

    const newSrcStatus = newSrcQty < srcMin ? 'Critical' : 'Adequate';
    const newDestStatus = newDestQty < destMin ? 'Critical' : 'Adequate';

    // Redis Transaction (Multi) to execute atomically
    const multi = client.multi();

    multi.hSet(srcResKey, {
      available_qty: String(newSrcQty),
      status: newSrcStatus,
      last_updated: timestamp
    });

    multi.hSet(destResKey, {
      available_qty: String(newDestQty),
      status: newDestStatus,
      last_updated: timestamp
    });

    multi.hSet(`idrn:center:metadata:${sourceCenterId}`, 'last_sync', timestamp);
    multi.hSet(`idrn:center:metadata:${targetCenterId}`, 'last_sync', timestamp);

    await multi.exec();

    const srcMeta = await client.hGetAll(`idrn:center:metadata:${sourceCenterId}`);
    const destMeta = await client.hGetAll(`idrn:center:metadata:${targetCenterId}`);
    const srcName = srcMeta.name || sourceCenterId;
    const destName = destMeta.name || targetCenterId;

    await logMovement({
      id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp,
      center_id: sourceCenterId,
      center_name: srcName,
      target_center_id: targetCenterId,
      target_center_name: destName,
      item_code: itemCode,
      item_name: srcData.name || itemCode,
      type: 'transfer',
      quantity: qtyToTransfer,
      details: `Transferred ${qtyToTransfer} units of ${srcData.name || itemCode} from ${srcName} to ${destName}.`
    });

    return {
      success: true,
      item_code: itemCode,
      source: {
        center_id: sourceCenterId,
        previous_qty: srcQty,
        new_qty: newSrcQty,
        status: newSrcStatus
      },
      target: {
        center_id: targetCenterId,
        previous_qty: destQty,
        new_qty: newDestQty,
        status: newDestStatus
      }
    };
  } else {
    // Offline local JSON file mode
    console.log('Redis offline: Executing transfer in local file database.');
    const localData = await readLocalData();

    const srcCenter = localData.find(c => c.center_id === sourceCenterId);
    const destCenter = localData.find(c => c.center_id === targetCenterId);

    if (!srcCenter || !destCenter) {
      throw new Error('One or both centers do not exist in local database.');
    }

    const srcResource = srcCenter.resources.find(r => r.item_code === itemCode);
    const destResource = destCenter.resources.find(r => r.item_code === itemCode);

    if (!srcResource || !destResource) {
      throw new Error(`Resource "${itemCode}" not found in one or both centers.`);
    }

    if (srcResource.available_qty < qtyToTransfer) {
      throw new Error(`Insufficient inventory at source: requested ${qtyToTransfer}, but only ${srcResource.available_qty} available.`);
    }

    srcResource.available_qty -= qtyToTransfer;
    destResource.available_qty += qtyToTransfer;

    srcResource.metadata.status = srcResource.available_qty < srcResource.min_threshold ? 'Critical' : 'Adequate';
    destResource.metadata.status = destResource.available_qty < destResource.min_threshold ? 'Critical' : 'Adequate';

    srcResource.last_updated = timestamp;
    destResource.last_updated = timestamp;

    srcCenter.last_sync = timestamp;
    destCenter.last_sync = timestamp;

    await writeLocalData(localData);

    await logMovement({
      id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp,
      center_id: sourceCenterId,
      center_name: srcCenter.center_name,
      target_center_id: targetCenterId,
      target_center_name: destCenter.center_name,
      item_code: itemCode,
      item_name: srcResource.name,
      type: 'transfer',
      quantity: qtyToTransfer,
      details: `Transferred ${qtyToTransfer} units of ${srcResource.name} from ${srcCenter.center_name} to ${destCenter.center_name}.`
    });

    return {
      success: true,
      item_code: itemCode,
      source: {
        center_id: sourceCenterId,
        new_qty: srcResource.available_qty,
        status: srcResource.metadata.status
      },
      target: {
        center_id: targetCenterId,
        new_qty: destResource.available_qty,
        status: destResource.metadata.status
      }
    };
  }
}

/**
 * Retrieves all items currently below their minimum thresholds.
 */
async function checkShortages() {
  const centers = await getAllCenters();
  const shortages = [];

  centers.forEach(center => {
    center.resources.forEach(res => {
      if (res.available_qty < res.min_threshold) {
        shortages.push({
          center_id: center.center_id,
          center_name: center.center_name,
          district: center.district,
          region: center.region,
          item_code: res.item_code,
          name: res.name,
          available_qty: res.available_qty,
          min_threshold: res.min_threshold,
          deficit: res.min_threshold - res.available_qty,
          category: res.metadata.category,
          unit: res.metadata.unit
        });
      }
    });
  });

  return shortages;
}

/**
 * Simulates a disaster-related emergency consumption spike by drawing down
 * a specified percentage (e.g. 0.50 = 50%) of a specific item in a center.
 */
async function simulateEmergencySpike(centerId, itemCode, percentSpike = 0.5) {
  if (percentSpike <= 0 || percentSpike >= 1) {
    throw new Error('Percent spike must be a decimal between 0 and 1 (exclusive).');
  }

  let currentQty = 0;

  if (isRedisActive()) {
    const client = cacheService.getClient();
    const resourceKey = `idrn:center:resource:${centerId}:${itemCode}`;
    const resData = await client.hGetAll(resourceKey);
    if (!resData || Object.keys(resData).length === 0) {
      throw new Error(`Resource "${itemCode}" not found.`);
    }
    currentQty = parseIntSafe(resData.available_qty);
  } else {
    const localData = await readLocalData();
    const center = localData.find(c => c.center_id === centerId);
    const res = center ? center.resources.find(r => r.item_code === itemCode) : null;
    if (!res) throw new Error(`Resource "${itemCode}" not found.`);
    currentQty = res.available_qty;
  }

  // Drawdown amount
  const drawdown = Math.round(currentQty * percentSpike);
  // Ensure we reduce at least 1 unit if currentQty > 0
  const actualReduction = drawdown > 0 ? -drawdown : (currentQty > 0 ? -1 : 0);

  console.log(`[SPIKE SIM] Reducing center "${centerId}" item "${itemCode}" quantity by ${Math.round(percentSpike * 100)}% (change: ${actualReduction})`);
  return await adjustInventory(centerId, itemCode, actualReduction, 'spike');
}

/**
 * Logs an inventory movement (replenishment, consumption, transfer, spike).
 * Saves to both Redis (LPUSH/LTRIM) and local JSON file fallback.
 */
async function logMovement(movement) {
  if (isRedisActive()) {
    try {
      const client = cacheService.getClient();
      await client.lPush('idrn:movements', JSON.stringify(movement));
      await client.lTrim('idrn:movements', 0, 99);
    } catch (err) {
      console.error('Failed to log movement to Redis:', err.message);
    }
  }

  // Dual-writing to local file for absolute offline consistency
  try {
    const movementsPath = path.join(__dirname, '../data/mock_movements.json');
    let movements = [];
    try {
      const raw = await fs.readFile(movementsPath, 'utf8');
      movements = JSON.parse(raw);
    } catch (e) {
      // file might not exist yet
    }
    movements.unshift(movement);
    if (movements.length > 100) {
      movements = movements.slice(0, 100);
    }
    await fs.writeFile(movementsPath, JSON.stringify(movements, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to log movement to local file:', err.message);
  }
}

/**
 * Retrieves recent movements log (max 100 items).
 */
async function getRecentMovements() {
  if (isRedisActive()) {
    try {
      const client = cacheService.getClient();
      const rawMovements = await client.lRange('idrn:movements', 0, 99);
      if (rawMovements && rawMovements.length > 0) {
        return rawMovements.map(m => JSON.parse(m));
      }
    } catch (err) {
      console.error('Failed to retrieve movements from Redis:', err.message);
    }
  }

  try {
    const movementsPath = path.join(__dirname, '../data/mock_movements.json');
    const raw = await fs.readFile(movementsPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

module.exports = {
  getAllCenters,
  getCenter,
  adjustInventory,
  transferInventory,
  checkShortages,
  simulateEmergencySpike,
  logMovement,
  getRecentMovements
};
