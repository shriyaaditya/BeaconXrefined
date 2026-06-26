require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const cacheService = require('../services/cacheService');

// Maharashtra districts & their specific warehouses
const STORAGE_CENTERS_TEMPLATE = [
  // 1. Mumbai Suburban
  {
    prefix: 'mum-sub',
    district: 'Mumbai Suburban',
    region: 'Konkan Division',
    centers: [
      { name: 'Mumbai Suburban EOC Depot (Bandra)', lat: 19.0607, lng: 72.8362 },
      { name: 'Kurla East Emergency Storehouse', lat: 19.0626, lng: 72.8906 },
      { name: 'Borivali Response Base', lat: 19.2290, lng: 72.8573 }
    ]
  },
  // 2. Pune
  {
    prefix: 'pune',
    district: 'Pune',
    region: 'Pune Division',
    centers: [
      { name: 'Pune Central Relief Hub', lat: 18.5204, lng: 73.8567 },
      { name: 'Pimpri-Chinchwad Logistics Depot', lat: 18.6298, lng: 73.7997 },
      { name: 'Haveli Sub-divisional Base', lat: 18.4722, lng: 73.8188 }
    ]
  },
  // 3. Thane
  {
    prefix: 'thane',
    district: 'Thane',
    region: 'Konkan Division',
    centers: [
      { name: 'Thane District Response Warehouse', lat: 19.2183, lng: 72.9781 },
      { name: 'Kalyan Sub-district Relief Depot', lat: 19.2403, lng: 73.1305 },
      { name: 'Mira-Bhayandar Emergency Store', lat: 19.2902, lng: 72.8712 }
    ]
  },
  // 4. Raigad
  {
    prefix: 'raigad',
    district: 'Raigad',
    region: 'Konkan Division',
    centers: [
      { name: 'Alibag Coast Guard Relief Station', lat: 18.6584, lng: 72.8777 },
      { name: 'Panvel Emergency Logistics Hub', lat: 18.9894, lng: 73.1175 },
      { name: 'Mahad Flood Response Center', lat: 18.0833, lng: 73.4167 }
    ]
  },
  // 5. Ratnagiri
  {
    prefix: 'ratna',
    district: 'Ratnagiri',
    region: 'Konkan Division',
    centers: [
      { name: 'Ratnagiri Port Emergency Store', lat: 16.9944, lng: 73.3000 },
      { name: 'Chiplun Flood Response Depot', lat: 17.5312, lng: 73.5178 },
      { name: 'Guhagar Cyclone Shelter Hub', lat: 17.4812, lng: 73.1931 }
    ]
  }
];

// Resources templates
const RESOURCE_TEMPLATES = [
  { item_code: 'IDRN-RE-001', name: 'Inflatable Gemini Rescue Boat (6-Person)', category: 'Rescue Equipment', unit: 'pieces', baseQty: 15, baseMin: 10 },
  { item_code: 'IDRN-RE-002', name: 'Fiberglass Speed Boat (10-Person)', category: 'Rescue Equipment', unit: 'pieces', baseQty: 5, baseMin: 4 },
  { item_code: 'IDRN-RE-003', name: 'Life Jacket (Adult, high-buoyancy)', category: 'Rescue Equipment', unit: 'pieces', baseQty: 120, baseMin: 100 },
  { item_code: 'IDRN-RE-004', name: 'Lifebuoy Ring with Grab Line', category: 'Rescue Equipment', unit: 'pieces', baseQty: 50, baseMin: 40 },
  
  { item_code: 'IDRN-MED-101', name: 'Trauma & First Aid Kit (Large)', category: 'Medical Supplies', unit: 'kits', baseQty: 80, baseMin: 50 },
  { item_code: 'IDRN-MED-102', name: 'Mobile Medical Unit Van', category: 'Medical Supplies', unit: 'vehicles', baseQty: 3, baseMin: 2 },
  { item_code: 'IDRN-MED-103', name: 'Emergency Stretcher (Foldable)', category: 'Medical Supplies', unit: 'pieces', baseQty: 25, baseMin: 20 },
  
  { item_code: 'IDRN-LGT-201', name: 'Aska Inflatable Light Tower (400W LED)', category: 'Lighting & Power', unit: 'pieces', baseQty: 10, baseMin: 8 },
  { item_code: 'IDRN-LGT-202', name: 'Handheld LED Searchlight (Rechargeable)', category: 'Lighting & Power', unit: 'pieces', baseQty: 60, baseMin: 40 },
  
  { item_code: 'IDRN-WAT-301', name: 'High-Capacity Diesel Water Pump (5 HP)', category: 'Water & Sanitation', unit: 'pieces', baseQty: 8, baseMin: 6 },
  { item_code: 'IDRN-WAT-302', name: 'Water Purification Tablet Carton (10,000 tabs)', category: 'Water & Sanitation', unit: 'cartons', baseQty: 400, baseMin: 500 }, // Under-stock
  
  { item_code: 'IDRN-SHT-401', name: 'Family Relief Tent (Waterproof, 6-person)', category: 'Shelter & Camps', unit: 'pieces', baseQty: 35, baseMin: 30 },
  { item_code: 'IDRN-SHT-402', name: 'Tarpaulin Sheet (High-density, 15x15 ft)', category: 'Shelter & Camps', unit: 'pieces', baseQty: 150, baseMin: 100 },
  
  { item_code: 'IDRN-FOD-501', name: 'Ready-to-Eat Meal Ration Packets', category: 'Food & Survival', unit: 'packets', baseQty: 1500, baseMin: 1000 },
  { item_code: 'IDRN-FOD-502', name: 'Bottled Drinking Water Case (24x1L)', category: 'Food & Survival', unit: 'cases', baseQty: 800, baseMin: 600 },
  
  { item_code: 'IDRN-GEN-601', name: 'Portable Diesel Generator Set (5kVA)', category: 'Lighting & Power', unit: 'pieces', baseQty: 6, baseMin: 5 },
  { item_code: 'IDRN-GEN-602', name: 'Heavy-Duty Diesel Generator Set (15kVA)', category: 'Lighting & Power', unit: 'pieces', baseQty: 2, baseMin: 2 },
  
  { item_code: 'IDRN-COM-701', name: 'VHF Walkie-Talkie Set (Waterproof)', category: 'Communication', unit: 'sets', baseQty: 40, baseMin: 30 },
  { item_code: 'IDRN-COM-702', name: 'Satellite Phone (ISatPhone 2)', category: 'Communication', unit: 'pieces', baseQty: 4, baseMin: 3 },
  
  { item_code: 'IDRN-VEH-801', name: '4x4 Emergency Rescue SUV', category: 'Emergency Vehicles', unit: 'vehicles', baseQty: 4, baseMin: 3 },
  { item_code: 'IDRN-VEH-802', name: 'Multi-utility Relief Cargo Truck (5 Ton)', category: 'Emergency Vehicles', unit: 'vehicles', baseQty: 3, baseMin: 2 }
];

function generateRealisticData() {
  const data = [];
  const timestamp = new Date().toISOString();

  STORAGE_CENTERS_TEMPLATE.forEach((districtGroup) => {
    districtGroup.centers.forEach((center, idx) => {
      const centerId = `wh-${districtGroup.prefix}-00${idx + 1}`;
      
      // Select a random set of resources (between 12 and 18 items out of templates)
      const shuffledTemplates = [...RESOURCE_TEMPLATES].sort(() => 0.5 - Math.random());
      const selectedResourceCount = Math.floor(Math.random() * 7) + 12; // 12 to 18 items
      
      const resourcesList = [];

      for (let i = 0; i < selectedResourceCount; i++) {
        const item = shuffledTemplates[i];
        
        // Randomize quantities realistic to the type of item
        let availableQty = item.baseQty;
        let minThreshold = item.baseMin;

        // Introduce variance (e.g. some warehouses have high stock, some low)
        const varianceFactor = 0.5 + Math.random(); // 0.5 to 1.5
        availableQty = Math.round(availableQty * varianceFactor);
        
        // Introduce ~25% chance of being under stocked/critical threshold
        const isCritical = Math.random() < 0.25;
        if (isCritical) {
          availableQty = Math.round(minThreshold * 0.7); // 30% below threshold
        }

        // Add a random offset to minThreshold to keep it dynamic
        minThreshold = Math.round(minThreshold * (0.8 + Math.random() * 0.4));

        // Ensure bounds
        if (availableQty < 0) availableQty = 0;
        if (minThreshold < 1) minThreshold = 1;

        resourcesList.push({
          item_code: item.item_code,
          name: item.name,
          available_qty: availableQty,
          min_threshold: minThreshold,
          last_updated: timestamp,
          metadata: {
            category: item.category,
            unit: item.unit,
            status: availableQty < minThreshold ? 'Critical' : 'Adequate'
          }
        });
      }

      data.push({
        center_id: centerId,
        center_name: center.name,
        latitude: center.lat,
        longitude: center.lng,
        district: districtGroup.district,
        region: districtGroup.region,
        resources: resourcesList,
        last_sync: timestamp
      });
    });
  });

  return data;
}

async function seed() {
  console.log('--- BEACONX SEEDING SYSTEM INITIALIZED ---');
  const generatedData = generateRealisticData();
  
  console.log(`Generated mock data successfully:`);
  console.log(`- Districts: ${STORAGE_CENTERS_TEMPLATE.length}`);
  console.log(`- Warehouses/Centers: ${generatedData.length}`);
  let totalResourceInstances = 0;
  generatedData.forEach(wh => totalResourceInstances += wh.resources.length);
  console.log(`- Total Inventory Records: ${totalResourceInstances}`);

  // 1. Write to local database mock file
  const mockFilePath = path.join(__dirname, '../data/mock_idrn_data.json');
  console.log(`Writing mock dataset to local file: ${mockFilePath}...`);
  
  try {
    await fs.writeFile(mockFilePath, JSON.stringify(generatedData, null, 2), 'utf8');
    console.log('✔ Successfully saved mock data to disk.');
  } catch (error) {
    console.error('❌ Failed to save mock data to disk:', error.message);
    process.exit(1);
  }

  // 2. Write to Redis Database
  console.log('Initializing Cache Service for Redis seeding...');
  try {
    await cacheService.initCache();
    if (cacheService.getIsRedisConnected()) {
      const client = cacheService.getClient();
      
      console.log('Preparing clean state by deleting existing database keys...');
      const keysToDelete = ['idrn:centers', 'idrn:resources'];
      for (const center of generatedData) {
        keysToDelete.push(`idrn:center:metadata:${center.center_id}`);
        keysToDelete.push(`idrn:center:resources:${center.center_id}`);
        for (const res of center.resources) {
          keysToDelete.push(`idrn:center:resource:${center.center_id}:${res.item_code}`);
        }
      }
      
      // Delete existing keys in chunks of 50 to avoid large payload limits
      for (let i = 0; i < keysToDelete.length; i += 50) {
        const chunk = keysToDelete.slice(i, i + 50);
        await client.del(chunk);
      }

      console.log('Seeding granular data structures into Redis...');
      const multi = client.multi();

      for (const center of generatedData) {
        // Add to Set of centers
        multi.sAdd('idrn:centers', center.center_id);
        
        // Save metadata hash
        multi.hSet(`idrn:center:metadata:${center.center_id}`, {
          name: center.center_name,
          district: center.district,
          lat: String(center.latitude),
          lng: String(center.longitude),
          region: center.region,
          last_sync: center.last_sync || new Date().toISOString()
        });

        for (const res of center.resources) {
          // Add to resources set of center
          multi.sAdd(`idrn:center:resources:${center.center_id}`, res.item_code);
          
          // Save resource details hash (no JSON strings inside fields)
          multi.hSet(`idrn:center:resource:${center.center_id}:${res.item_code}`, {
            name: res.name,
            available_qty: String(res.available_qty),
            min_threshold: String(res.min_threshold),
            category: res.metadata.category,
            unit: res.metadata.unit,
            status: res.metadata.status,
            last_updated: res.last_updated
          });
        }
      }

      await multi.exec();
      console.log('✔ Successfully seeded granular Cloud Redis database.');
    } else {
      console.warn('⚠ Redis connection is not established. Skipped Redis seeding (local file updated).');
    }
  } catch (error) {
    console.error('❌ Failed during Redis seeding operation:', error.message);
  }

  console.log('--- SEEDING COMPLETED ---');
  process.exit(0);
}

seed();
