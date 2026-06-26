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
    
    const schemaPath = '/Users/shriyadalai/.gemini/antigravity-ide/brain/b2da6533-2b99-4a6f-a53c-5f92eb2efb79/schema.sql';
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
