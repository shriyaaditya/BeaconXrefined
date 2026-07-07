const fs = require('fs').promises;
const path = require('path');
const cacheService = require('./cacheService');
const dbService = require('./dbService');

function isRedisActive() {
  return cacheService.getIsRedisConnected();
}

function parseIntSafe(val, defaultVal = 0) {
  const parsed = parseInt(val, 10);
  return isNaN(parsed) ? defaultVal : parsed;
}
function parseFloatSafe(val, defaultVal = 0) {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? defaultVal : parsed;
}

async function fetchCentersFromDB() {
  const query = `
    SELECT
      c.id as c_uuid, c.center_code, c.name as center_name, c.latitude, c.longitude, c.district, c.region, c.updated_at as center_updated_at,
      r.id as r_uuid, r.resource_code, r.name as resource_name, r.category, r.unit,
      i.available_qty, i.min_threshold, i.updated_at as inv_updated_at
    FROM centers c
    LEFT JOIN inventory i ON c.id = i.center_id
    LEFT JOIN resources r ON i.resource_id = r.id
  `;
  const result = await dbService.query(query);
  const centerMap = {};
  for (const row of result.rows) {
    if (!centerMap[row.center_code]) {
      centerMap[row.center_code] = {
        center_id: row.center_code,
        center_name: row.center_name,
        latitude: parseFloat(row.latitude) || 0,
        longitude: parseFloat(row.longitude) || 0,
        district: row.district,
        region: row.region,
        resources: [],
        last_sync: row.center_updated_at
      };
    }
    if (row.resource_code) {
      centerMap[row.center_code].resources.push({
        item_code: row.resource_code,
        name: row.resource_name,
        available_qty: row.available_qty,
        min_threshold: row.min_threshold,
        last_updated: row.inv_updated_at,
        metadata: {
          category: row.category,
          unit: row.unit,
          status: row.available_qty < row.min_threshold ? 'Critical' : 'Adequate'
        }
      });
    }
  }
  return Object.values(centerMap).sort((a, b) => a.center_id.localeCompare(b.center_id));
}

async function getAllCenters() {
  let centers = [];
  if (isRedisActive()) {
    try {
      const client = cacheService.getClient();
      const centerIds = await client.sMembers('idrn:centers');

      if (!centerIds || centerIds.length === 0) {
        console.log('No centers found in Redis. Fetching from Postgres.');
        centers = await fetchCentersFromDB();
      } else {
        const centersPromises = centerIds.map(centerId => getCenter(centerId));
        const resolved = await Promise.all(centersPromises);
        centers = resolved.filter(c => c !== null);
        centers.sort((a, b) => a.center_id.localeCompare(b.center_id));
      }
    } catch (err) {
      console.error('Failed to reconstruct inventory from Redis hashes:', err.message);
      centers = await fetchCentersFromDB();
    }
  } else {
    console.log('Redis offline: Fetching inventory from Postgres database.');
    centers = await fetchCentersFromDB();
  }

  try {
    const movements = await getRecentMovements();
    centers = attachMetrics(centers, movements);
  } catch (err) {
    console.error('Failed to attach EOC operational metrics:', err.message);
  }

  return centers;
}

function attachMetrics(centers, movements) {
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
      const relevantMovements = movements.filter(m =>
        m.center_id === center.center_id &&
        m.item_code === res.item_code &&
        (m.type === 'consume' || m.type === 'spike' || m.type === 'transfer')
      );

      let totalDrawdown = 0;
      relevantMovements.forEach(m => {
        if (m.type === 'transfer') {
          totalDrawdown += m.quantity; 
        } else {
          totalDrawdown += Math.abs(m.quantity); 
        }
      });

      const dynamicBurn = totalDrawdown / 12;
      const category = res.metadata.category || 'Default';
      const baseline = BASELINES[category] || 0.1;
      const burnRate = parseFloat((baseline + dynamicBurn).toFixed(2));

      let runoutHours = null;
      if (burnRate > 0) {
        runoutHours = parseFloat((res.available_qty / burnRate).toFixed(1));
      }

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

async function getCenter(centerId) {
  if (!isRedisActive()) {
    const centers = await fetchCentersFromDB();
    return centers.find(c => c.center_id === centerId) || null;
  }

  try {
    const client = cacheService.getClient();
    const [metadata, itemCodes] = await Promise.all([
      client.hGetAll(`idrn:center:metadata:${centerId}`),
      client.sMembers(`idrn:center:resources:${centerId}`)
    ]);

    if (!metadata || Object.keys(metadata).length === 0) {
      const centers = await fetchCentersFromDB();
      return centers.find(c => c.center_id === centerId) || null;
    }

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
    const centers = await fetchCentersFromDB();
    return centers.find(c => c.center_id === centerId) || null;
  }
}

async function adjustInventory(centerId, itemCode, quantityChange, type = 'adjust') {
  const changeVal = parseIntSafe(quantityChange);
  const timestamp = new Date().toISOString();

  const client = await dbService.getClient();
  let updatedResData = null;
  let centerName = centerId;
  let resourceName = itemCode;

  try {
    await client.query('BEGIN');

    const centerResult = await client.query('SELECT id, name FROM centers WHERE center_code = $1', [centerId]);
    if (centerResult.rowCount === 0) throw new Error(`Center "${centerId}" does not exist.`);
    const c_uuid = centerResult.rows[0].id;
    centerName = centerResult.rows[0].name;

    const resourceResult = await client.query('SELECT id, name, category, unit FROM resources WHERE resource_code = $1', [itemCode]);
    if (resourceResult.rowCount === 0) throw new Error(`Resource "${itemCode}" does not exist.`);
    const r_uuid = resourceResult.rows[0].id;
    resourceName = resourceResult.rows[0].name;

    const invResult = await client.query('SELECT available_qty, min_threshold FROM inventory WHERE center_id = $1 AND resource_id = $2 FOR UPDATE', [c_uuid, r_uuid]);
    if (invResult.rowCount === 0) {
      await client.query('INSERT INTO inventory (center_id, resource_id, available_qty, min_threshold) VALUES ($1, $2, $3, $4)', [c_uuid, r_uuid, Math.max(0, changeVal), 0]);
    }

    const currentQty = invResult.rowCount > 0 ? invResult.rows[0].available_qty : 0;
    const minThreshold = invResult.rowCount > 0 ? invResult.rows[0].min_threshold : 0;
    let newQty = currentQty + changeVal;
    if (newQty < 0) newQty = 0;

    await client.query('UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE center_id = $2 AND resource_id = $3', [newQty, c_uuid, r_uuid]);

    let actionType = 'correction';
    if (type === 'replenish') actionType = 'restock';
    else if (type === 'consume' || type === 'spike') actionType = 'dispatch';

    const reasonStr = `${type === 'replenish' ? 'Replenished' : type === 'spike' ? 'Emergency drawdown (disaster spike)' : 'Adjusted'} ${Math.abs(changeVal)} units of ${resourceName} at ${centerName}.`;

    await client.query(`
      INSERT INTO inventory_transactions (center_id, resource_id, quantity_change, action_type, reason)
      VALUES ($1, $2, $3, $4, $5)
    `, [c_uuid, r_uuid, changeVal, actionType, reasonStr]);

    await client.query('COMMIT');

    const newStatus = newQty < minThreshold ? 'Critical' : 'Adequate';
    updatedResData = {
      item_code: itemCode,
      name: resourceName,
      available_qty: newQty,
      min_threshold: minThreshold,
      last_updated: timestamp,
      metadata: {
        category: resourceResult.rows[0].category,
        unit: resourceResult.rows[0].unit,
        status: newStatus
      }
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let redisSuccess = false;
  if (isRedisActive()) {
    try {
      const rClient = cacheService.getClient();
      const resourceKey = `idrn:center:resource:${centerId}:${itemCode}`;
      
      const resData = await rClient.hGetAll(resourceKey);
      if (resData && Object.keys(resData).length > 0) {
        await rClient.hSet(resourceKey, {
          available_qty: String(updatedResData.available_qty),
          status: updatedResData.metadata.status,
          last_updated: timestamp
        });
      } else {
        await rClient.hSet(resourceKey, {
          name: updatedResData.name,
          category: updatedResData.metadata.category,
          unit: updatedResData.metadata.unit,
          available_qty: String(updatedResData.available_qty),
          min_threshold: String(updatedResData.min_threshold),
          status: updatedResData.metadata.status,
          last_updated: timestamp
        });
        await rClient.sAdd(`idrn:center:resources:${centerId}`, itemCode);
      }

      const itemCodes = await rClient.sMembers(`idrn:center:resources:${centerId}`);
      let criticalCount = 0;
      let scoreWeight = 0;
      for (const code of itemCodes) {
        const res = await rClient.hGetAll(`idrn:center:resource:${centerId}:${code}`);
        if (res && res.available_qty) {
          const qty = parseIntSafe(res.available_qty);
          const thres = parseIntSafe(res.min_threshold);
          if (qty < thres) criticalCount++;
          scoreWeight += Math.min(qty / (thres || 1), 1.0);
        }
      }
      const healthScore = itemCodes.length > 0 ? Math.round((scoreWeight / itemCodes.length) * 100) : 100;
      await rClient.hSet(`idrn:center:metadata:${centerId}`, {
        last_sync: timestamp,
        critical_count: criticalCount,
        health_score: healthScore
      });
      redisSuccess = true;
    } catch (redisErr) {
      console.error('Failed to update Redis after Postgres transaction:', redisErr.message);
    }
  }

  await logMovement({
    id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp,
    center_id: centerId,
    center_name: centerName,
    item_code: itemCode,
    item_name: resourceName,
    type,
    quantity: changeVal,
    details: `${type === 'replenish' ? 'Replenished' : type === 'spike' ? 'Emergency drawdown (disaster spike)' : 'Adjusted'} ${Math.abs(changeVal)} units of ${resourceName} at ${centerName}.`
  });

  updatedResData.redisSuccess = redisSuccess;
  return updatedResData;
}

async function transferInventory(sourceCenterId, targetCenterId, itemCode, quantity) {
  const qtyToTransfer = parseIntSafe(quantity);
  if (qtyToTransfer <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }
  const timestamp = new Date().toISOString();

  const client = await dbService.getClient();
  let srcName = sourceCenterId;
  let destName = targetCenterId;
  let resourceName = itemCode;
  
  let newSrcQty = 0;
  let newDestQty = 0;
  let srcStatus = '';
  let destStatus = '';

  try {
    await client.query('BEGIN');

    const srcCenterResult = await client.query('SELECT id, name FROM centers WHERE center_code = $1', [sourceCenterId]);
    const destCenterResult = await client.query('SELECT id, name FROM centers WHERE center_code = $1', [targetCenterId]);
    if (srcCenterResult.rowCount === 0) throw new Error(`Source Center "${sourceCenterId}" does not exist.`);
    if (destCenterResult.rowCount === 0) throw new Error(`Target Center "${targetCenterId}" does not exist.`);
    
    const src_uuid = srcCenterResult.rows[0].id;
    const dest_uuid = destCenterResult.rows[0].id;
    srcName = srcCenterResult.rows[0].name;
    destName = destCenterResult.rows[0].name;

    const resourceResult = await client.query('SELECT id, name FROM resources WHERE resource_code = $1', [itemCode]);
    if (resourceResult.rowCount === 0) throw new Error(`Resource "${itemCode}" does not exist.`);
    const r_uuid = resourceResult.rows[0].id;
    resourceName = resourceResult.rows[0].name;

    const uuids = [src_uuid, dest_uuid].sort();
    const invResult = await client.query('SELECT center_id, available_qty, min_threshold FROM inventory WHERE center_id = ANY($1::uuid[]) AND resource_id = $2 FOR UPDATE', [uuids, r_uuid]);
    
    let srcInv = invResult.rows.find(r => r.center_id === src_uuid);
    let destInv = invResult.rows.find(r => r.center_id === dest_uuid);

    if (!srcInv) throw new Error(`Inventory record not found for source center "${sourceCenterId}" and resource "${itemCode}".`);
    if (!destInv) {
      await client.query('INSERT INTO inventory (center_id, resource_id, available_qty, min_threshold) VALUES ($1, $2, $3, $4)', [dest_uuid, r_uuid, 0, 0]);
      destInv = { available_qty: 0, min_threshold: 0 };
    }

    if (srcInv.available_qty < qtyToTransfer) {
      throw new Error(`Insufficient inventory at source: requested ${qtyToTransfer}, but only ${srcInv.available_qty} available.`);
    }

    newSrcQty = srcInv.available_qty - qtyToTransfer;
    newDestQty = destInv.available_qty + qtyToTransfer;

    srcStatus = newSrcQty < srcInv.min_threshold ? 'Critical' : 'Adequate';
    destStatus = newDestQty < destInv.min_threshold ? 'Critical' : 'Adequate';

    await client.query('UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE center_id = $2 AND resource_id = $3', [newSrcQty, src_uuid, r_uuid]);
    await client.query('UPDATE inventory SET available_qty = $1, updated_at = NOW() WHERE center_id = $2 AND resource_id = $3', [newDestQty, dest_uuid, r_uuid]);

    const reasonStr = `Transferred ${qtyToTransfer} units of ${resourceName} from ${srcName} to ${destName}.`;

    await client.query(`
      INSERT INTO inventory_transactions (center_id, resource_id, quantity_change, action_type, reason)
      VALUES ($1, $2, $3, $4, $5)
    `, [src_uuid, r_uuid, -qtyToTransfer, 'transfer_out', reasonStr]);

    await client.query(`
      INSERT INTO inventory_transactions (center_id, resource_id, quantity_change, action_type, reason)
      VALUES ($1, $2, $3, $4, $5)
    `, [dest_uuid, r_uuid, qtyToTransfer, 'transfer_in', reasonStr]);

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  let redisSuccess = false;
  if (isRedisActive()) {
    try {
      const rClient = cacheService.getClient();
      const multi = rClient.multi();
      multi.hSet(`idrn:center:resource:${sourceCenterId}:${itemCode}`, {
        available_qty: String(newSrcQty),
        status: srcStatus,
        last_updated: timestamp
      });
      multi.hSet(`idrn:center:resource:${targetCenterId}:${itemCode}`, {
        available_qty: String(newDestQty),
        status: destStatus,
        last_updated: timestamp
      });
      multi.hSet(`idrn:center:metadata:${sourceCenterId}`, 'last_sync', timestamp);
      multi.hSet(`idrn:center:metadata:${targetCenterId}`, 'last_sync', timestamp);
      await multi.exec();
      redisSuccess = true;
    } catch (redisErr) {
      console.error('Failed to update Redis after Postgres transfer transaction:', redisErr.message);
    }
  }

  await logMovement({
    id: 'mvt-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
    timestamp,
    center_id: sourceCenterId,
    center_name: srcName,
    target_center_id: targetCenterId,
    target_center_name: destName,
    item_code: itemCode,
    item_name: resourceName,
    type: 'transfer',
    quantity: qtyToTransfer,
    details: `Transferred ${qtyToTransfer} units of ${resourceName} from ${srcName} to ${destName}.`
  });

  return {
    success: true,
    redisSuccess,
    item_code: itemCode,
    source: {
      center_id: sourceCenterId,
      new_qty: newSrcQty,
      status: srcStatus
    },
    target: {
      center_id: targetCenterId,
      new_qty: newDestQty,
      status: destStatus
    }
  };
}

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

  try {
    const movementsPath = path.join(__dirname, '../data/mock_movements.json');
    let movements = [];
    try {
      const raw = await fs.readFile(movementsPath, 'utf8');
      movements = JSON.parse(raw);
    } catch (e) {}
    movements.unshift(movement);
    if (movements.length > 100) {
      movements = movements.slice(0, 100);
    }
    await fs.writeFile(movementsPath, JSON.stringify(movements, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to log movement to local file:', err.message);
  }
}

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
  logMovement,
  getRecentMovements,
  fetchCentersFromDB
};
