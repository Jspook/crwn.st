// ==========================================================
// crwn.st Database Layer — MySQL Only
// Connected to: webdev.it.kmitl.ac.th
// ==========================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 18385,
  ssl: {
    rejectUnauthorized: false // Required for Aiven connection without local CA certificate
  },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4',
});

/**
 * Execute a query returning multiple rows
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/**
 * Execute a query returning a single row
 */
async function get(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows[0] || null;
}

/**
 * Execute an INSERT / UPDATE / DELETE query
 */
async function run(sql, params = []) {
  const [result] = await pool.execute(sql, params);
  return { changes: result.affectedRows, insertId: result.insertId };
}

/**
 * Execute a callback within a database transaction
 * callback receives a tx object with { query, get, run } methods
 */
async function withTransaction(callback) {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  const tx = {
    query: async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows;
    },
    get: async (sql, params = []) => {
      const [rows] = await connection.execute(sql, params);
      return rows[0] || null;
    },
    run: async (sql, params = []) => {
      const [result] = await connection.execute(sql, params);
      return { changes: result.affectedRows, insertId: result.insertId };
    }
  };
  try {
    const result = await callback(tx);
    await connection.commit();
    return result;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

/**
 * Execute raw DDL statements (e.g. table creation)
 */
async function exec(sql) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

/**
 * Initialize database — verify connection
 */
async function initDb() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected to MySQL database ');
    conn.release();
  } catch (err) {
    console.error('❌ Failed to connect to MySQL:', err.message);
    throw err;
  }
}

module.exports = {
  query,
  get,
  run,
  exec,
  withTransaction,
  initDb,
};
