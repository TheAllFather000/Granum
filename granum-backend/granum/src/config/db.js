const { Pool } = require('pg');

let poolConfig;

if (process.env.DATABASE_URL) {
  poolConfig = { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } };
} else if (process.env.POSTGRES_HOST) {
  poolConfig = {
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || process.env.DB_NAME || 'linkhive',
    user: process.env.POSTGRES_USER || process.env.DB_USER || 'linkhive',
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'linkhive_secret',
  };
} else {
  poolConfig = {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME     || 'linkhive',
    user:     process.env.DB_USER     || 'linkhive',
    password: process.env.DB_PASSWORD || 'linkhive_secret',
  };
}

poolConfig.max = 20;
poolConfig.idleTimeoutMillis = 30_000;
poolConfig.connectionTimeoutMillis = 5_000;

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// helper: run a query and return rows
async function query(sql, params = []) {
  const client = await pool.connect();
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

// helper: run multiple queries in a transaction
async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, transaction };
