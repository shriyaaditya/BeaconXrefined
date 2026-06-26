// routes/analysisRoutes.js
// New analysis API endpoints for historical analytics and deep‑dive data.

const express = require('express');
const router = express.Router();

const db = require('../services/dbService');
const redis = require('../services/redisService');

/**
 * GET /analysis/overview
 * Returns aggregated data for the top‑warehouse rail.
 * Merges live metrics from Redis with historical activity from PostgreSQL.
 */
router.get('/overview', async (req, res) => {
  try {
    // 1️⃣ Fetch basic center info from PostgreSQL (placeholder query).
    const pgResult = await db.query(
      `SELECT center_id, center_name, district, region, last_sync FROM centers ORDER BY center_id`
    );
    const centers = pgResult.rows;

    // 2️⃣ Enrich each center with live metrics from Redis.
    const enriched = await Promise.all(
      centers.map(async (c) => {
        const metaKey = `idrn:center:metadata:${c.center_id}`;
        const liveMeta = await redis.hgetAll(metaKey);
        // Compute health score placeholder (e.g., based on availability of critical resources).
        const healthScore = liveMeta.health_score ? Number(liveMeta.health_score) : 0;
        const criticalCount = liveMeta.critical_count ? Number(liveMeta.critical_count) : 0;
        const burnRateChange = liveMeta.burn_rate_change ? Number(liveMeta.burn_rate_change) : 0;
        // Mini depletion sparkline data could be stored as JSON string.
        const sparkline = liveMeta.sparkline ? JSON.parse(liveMeta.sparkline) : [];
        return {
          center_id: c.center_id,
          center_name: c.center_name,
          district: c.district,
          region: c.region,
          last_updated: c.last_sync,
          health_score: healthScore,
          critical_resource_count: criticalCount,
          burn_rate_change: burnRateChange,
          sparkline,
        };
      })
    );

    res.json({ status: 'success', data: enriched });
  } catch (err) {
    console.error('[Analysis] Overview error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /analysis/warehouse/:id
 * Returns merged live (Redis) and historical (PostgreSQL) data for a specific warehouse.
 */
router.get('/warehouse/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Live inventory from Redis (hashes per resource).
    const resourceIds = await redis.zrangeByScore(`idrn:center:resources:${id}`, '-inf', '+inf');
    const liveResources = await Promise.all(
      resourceIds.map(async (code) => {
        const obj = await redis.hgetAll(`idrn:center:resource:${id}:${code}`);
        return {
          item_code: code,
          name: obj.name,
          available_qty: Number(obj.available_qty),
          min_threshold: Number(obj.min_threshold),
          last_updated: obj.last_updated,
          metadata: {
            category: obj.category,
            unit: obj.unit,
            status: obj.status,
          },
          burn_rate: obj.burn_rate ? Number(obj.burn_rate) : undefined,
          runout_hours: obj.runout_hours ? Number(obj.runout_hours) : null,
        };
      })
    );

    // Historical trends from PostgreSQL (placeholder 30‑day aggregation).
    const histResult = await db.query(
      `SELECT item_code, SUM(quantity) AS total_consumed, AVG(burn_rate) AS avg_burn_rate
       FROM transactions
       WHERE center_id = $1 AND timestamp >= now() - interval '30 days'
       GROUP BY item_code`,
      [id]
    );
    const histMap = {};
    histResult.rows.forEach((row) => {
      histMap[row.item_code] = {
        total_consumed: Number(row.total_consumed),
        avg_burn_rate: Number(row.avg_burn_rate),
      };
    });

    // Merge live and historical data.
    const merged = liveResources.map((res) => {
      const hist = histMap[res.item_code] || {};
      return {
        ...res,
        historical: hist,
      };
    });

    res.json({ status: 'success', data: { center_id: id, resources: merged } });
  } catch (err) {
    console.error('[Analysis] Warehouse detail error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

/**
 * GET /analysis/resource/:resourceId
 * Returns depletion graph, usage trend, burn rate, predicted stock‑out and transaction history for a resource.
 */
router.get('/resource/:resourceId', async (req, res) => {
  const { resourceId } = req.params;
  try {
    // Historical usage from PostgreSQL.
    const usageResult = await db.query(
      `SELECT timestamp, quantity FROM transactions WHERE item_code = $1 ORDER BY timestamp DESC LIMIT 100`,
      [resourceId]
    );
    const usage = usageResult.rows.map((r) => ({ ts: r.timestamp, qty: Number(r.quantity) }));

    // Current live state from Redis (we assume a global key for the resource).
    const live = await redis.hgetAll(`idrn:resource:${resourceId}`);
    const available = live ? Number(live.available_qty) : null;
    const burnRate = live && live.burn_rate ? Number(live.burn_rate) : null;
    const predictedRunout = burnRate && burnRate > 0 ? Number((available / burnRate).toFixed(1)) : null;

    res.json({
      status: 'success',
      data: {
        resource_id: resourceId,
        usage,
        live: {
          available_qty: available,
          burn_rate: burnRate,
          predicted_runout_hours: predictedRunout,
        },
      },
    });
  } catch (err) {
    console.error('[Analysis] Resource detail error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

module.exports = router;
