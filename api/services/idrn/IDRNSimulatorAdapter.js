const fs = require('fs').promises;
const path = require('path');
const { IDRNGatewayInterface, IDRNGatewayError } = require('./IDRNGatewayInterface');

/**
 * IDRNSimulatorAdapter
 * 
 * Simulates a realistic Government IDRN API response. Used during the prototype
 * phase because actual IDRN APIs require authorization and are not publicly accessible.
 * Mimics the expected API contract to allow seamless replacement with a production adapter.
 */
class IDRNSimulatorAdapter extends IDRNGatewayInterface {
  constructor() {
    super();
    this.mockDataPath = path.join(__dirname, '../../data/mock_idrn_data.json');
  }

  /**
   * Fetches the simulated master catalog data from local mock JSON.
   * Strips out operational inventory fields to enforce strict data separation.
   */
  async fetchMasterCatalog() {
    try {
      const rawData = await fs.readFile(this.mockDataPath, 'utf8');
      const mockData = JSON.parse(rawData);

      // Map over the mock data to return only master catalog fields, stripping operational values
      const masterCatalog = mockData.map(center => {
        return {
          center_id: center.center_id,
          center_name: center.center_name,
          latitude: center.latitude,
          longitude: center.longitude,
          district: center.district,
          region: center.region,
          resources: (center.resources || []).map(res => ({
            item_code: res.item_code,
            name: res.name,
            min_threshold: res.min_threshold,
            metadata: {
              category: res.metadata?.category,
              unit: res.metadata?.unit
            }
          }))
        };
      });

      return masterCatalog;
    } catch (error) {
      console.error('[IDRNSimulatorAdapter] Error reading simulated data:', error);
      throw new IDRNGatewayError('Failed to fetch simulated master catalog from IDRN.', 500);
    }
  }
}

module.exports = IDRNSimulatorAdapter;
