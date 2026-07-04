require('dotenv').config();
const db = require('../services/dbService');
async function inspect() {
  try {
    const res = await db.query(`
      SELECT
        tc.table_name, kcu.column_name, tc.constraint_type
      FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY');
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
inspect();
