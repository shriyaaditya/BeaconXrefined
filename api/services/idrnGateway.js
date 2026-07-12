const dbService = require('./dbService');
const cacheService = require('./cacheService');
const IDRNSimulatorAdapter = require('./idrn/IDRNSimulatorAdapter');

/**
 * IDRN Gateway Integration Service
 * 
 * Manages the synchronization of master resource catalog data from the IDRN.
 * Delegates actual fetching to the configured IDRNGatewayInterface adapter.
 */
class IDRNGateway {
  constructor() {
    // Currently using the simulator since live government APIs are restricted.
    // In the future, this can be swapped with a GovernmentIDRNAdapter.
    this.adapter = new IDRNSimulatorAdapter();
  }

  /**
   * Synchronizes the master resource catalog from IDRN into PostgreSQL and Redis.
   * STRICT SEPARATION: Only updates Centers, Resources, and Min Thresholds.
   * Does NOT update operational quantities (available_qty).
   * 
   * @returns {Promise<Array>} The synchronized master catalog data
   */
  async syncCatalog() {
    console.log('[IDRN Gateway] Initiating master catalog sync...');

    // 1. Fetch from Adapter
    const catalogData = await this.adapter.fetchMasterCatalog();

    // 2. Synchronize to PostgreSQL (Master Data Only)
    const client = await dbService.getClient();
    try {
      await client.query('BEGIN');

      for (const center of catalogData) {
        // Upsert Center
        const centerUpsert = `
          INSERT INTO centers (center_code, name, latitude, longitude, district, region, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
          ON CONFLICT (center_code) DO UPDATE SET
            name = EXCLUDED.name,
            latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            district = EXCLUDED.district,
            region = EXCLUDED.region,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id;
        `;
        const centerResult = await client.query(centerUpsert, [
          center.center_id,
          center.center_name,
          center.latitude,
          center.longitude,
          center.district,
          center.region
        ]);
        const centerDbId = centerResult.rows[0].id;

        for (const res of center.resources) {
          // Upsert Resource
          const resUpsert = `
            INSERT INTO resources (resource_code, name, category, unit)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (resource_code) DO UPDATE SET
              name = EXCLUDED.name,
              category = EXCLUDED.category,
              unit = EXCLUDED.unit
            RETURNING id;
          `;
          const resResult = await client.query(resUpsert, [
            res.item_code,
            res.name,
            res.metadata.category || 'Uncategorized',
            res.metadata.unit || 'units'
          ]);
          const resourceDbId = resResult.rows[0].id;

          // Upsert Inventory Mapping (Min Threshold Only)
          // Preserves operational `available_qty` if the row already exists.
          const invUpsert = `
            INSERT INTO inventory (center_id, resource_id, available_qty, min_threshold, updated_at)
            VALUES ($1, $2, 0, $3, CURRENT_TIMESTAMP)
            ON CONFLICT (center_id, resource_id) DO UPDATE SET
              min_threshold = EXCLUDED.min_threshold,
              updated_at = CURRENT_TIMESTAMP;
          `;
          await client.query(invUpsert, [centerDbId, resourceDbId, res.min_threshold || 0]);
        }
      }

      await client.query('COMMIT');
      console.log('[IDRN Gateway] PostgreSQL catalog sync completed.');
    } catch (dbError) {
      await client.query('ROLLBACK');
      console.error('[IDRN Gateway] Database sync failed:', dbError);
      throw new Error('IDRN database sync failed');
    } finally {
      client.release();
    }

    // 3. Cache the static catalog data in Redis
    const cacheKey = 'idrn:master_catalog';//Namespace, groups all IDRN‑related cached entries together
    try {
      await cacheService.set(cacheKey, catalogData, 3600);
      console.log('[IDRN Gateway] Redis master catalog cache refreshed.');
    } catch (cacheError) {
      console.warn('[IDRN Gateway] Non-fatal: Failed to update Redis catalog cache:', cacheError.message);
    }

    return catalogData;
  }
}

module.exports = new IDRNGateway();
