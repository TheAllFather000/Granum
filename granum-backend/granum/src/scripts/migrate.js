require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { pool } = require('../config/db');

async function migrate() {
  console.log('[Migrate] Running database migrations...');
  const sqlPath = path.join(__dirname, '../../migrations/init.sql');

  if (!fs.existsSync(sqlPath)) {
    console.error('[Migrate] init.sql not found at', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const client = await pool.connect();

  try {
    await client.query(sql);
    console.log('[Migrate] ✅ Schema applied successfully');
  } catch (err) {
    // "already exists" errors are fine on repeated runs
    if (err.code === '42P07' || err.message.includes('already exists')) {
      console.log('[Migrate] Schema already up to date');
    } else {
      console.error('[Migrate] ❌ Error:', err.message);
      process.exit(1);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
