const db = require('../services/dbService');
async function check() {
  const res = await db.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'inventory_transactions'");
  console.log(res.rows);
  process.exit(0);
}
check();
