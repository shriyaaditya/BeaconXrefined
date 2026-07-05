const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Client } = require('pg');

async function executeSchema() {
  // Use DIRECT_URL for migrations/schema execution
  const connectionString = process.env.DIRECT_URL;
  if (!connectionString) {
    console.error('DIRECT_URL is not defined in .env');
    process.exit(1);
  }

  const client = new Client({ connectionString });

  try {
    console.log('Connecting to Supabase...');
    await client.connect();

    // --- NEW: relative path inside the api folder ---
    const schemaPath = path.join(__dirname, '../schema.sql');
    console.log(`Reading schema from ${schemaPath}...`);
    const sql = fs.readFileSync(schemaPath, 'utf8');

    console.log('Executing schema...');
    await client.query(sql);

    console.log('✔ Schema executed successfully.');
  } catch (err) {
    console.error('❌ Error executing schema:', err.message);
  } finally {
    await client.end();
  }
}

executeSchema();
