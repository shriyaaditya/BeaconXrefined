require('dotenv').config();
const db = require('../services/dbService');
async function inspect() {
  try {
    const res = await db.query(`
      SELECT column_name, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'created_by';
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
inspect();
