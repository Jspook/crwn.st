// ==========================================================
// crwn.st Database Abstraction Layer
// Supports SQLite (default, zero-config) & MySQL (via environment)
// Matches ER Diagram: ERD-070969
// ==========================================================

const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

let sqliteDb = null;
let mysqlPool = null;

const DB_TYPE = (process.env.DB_TYPE || (process.env.MYSQL_HOST ? 'mysql' : 'sqlite')).toLowerCase();

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function getSqliteDb() {
  if (!sqliteDb) {
    const dbPath = path.join(dataDir, 'crwn_store.db');
    sqliteDb = new DatabaseSync(dbPath);
    sqliteDb.exec('PRAGMA foreign_keys = ON;');
  }
  return sqliteDb;
}

function getMysqlPool() {
  if (!mysqlPool && DB_TYPE === 'mysql') {
    const mysql = require('mysql2/promise');
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'crwn_store',
      port: Number(process.env.MYSQL_PORT) || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }
  return mysqlPool;
}

/**
 * Execute a query returning multiple rows
 */
async function query(sql, params = []) {
  if (DB_TYPE === 'mysql') {
    const pool = getMysqlPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
  } else {
    const db = getSqliteDb();
    const stmt = db.prepare(sql);
    return stmt.all(...params);
  }
}

/**
 * Execute a query returning a single row
 */
async function get(sql, params = []) {
  if (DB_TYPE === 'mysql') {
    const pool = getMysqlPool();
    const [rows] = await pool.execute(sql, params);
    return rows[0] || null;
  } else {
    const db = getSqliteDb();
    const stmt = db.prepare(sql);
    const row = stmt.get(...params);
    return row || null;
  }
}

/**
 * Execute an INSERT / UPDATE / DELETE query
 */
async function run(sql, params = []) {
  if (DB_TYPE === 'mysql') {
    const pool = getMysqlPool();
    const [result] = await pool.execute(sql, params);
    return { changes: result.affectedRows, insertId: result.insertId };
  } else {
    const db = getSqliteDb();
    const stmt = db.prepare(sql);
    const result = stmt.run(...params);
    return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
  }
}

/**
 * Execute raw DDL statements (e.g. table creation)
 */
async function exec(sql) {
  if (DB_TYPE === 'mysql') {
    const pool = getMysqlPool();
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    for (const stmt of statements) {
      await pool.query(stmt);
    }
  } else {
    const db = getSqliteDb();
    db.exec(sql);
  }
}

/**
 * Initialize database schema and initial seed data
 */
async function initDb() {
  if (DB_TYPE === 'sqlite') {
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      const db = getSqliteDb();
      db.exec(schemaSql);
    }
  }

  // Check if ITEM table has data; if not, seed data
  try {
    const itemCount = await get('SELECT COUNT(*) as count FROM ITEM');
    if (!itemCount || itemCount.count === 0) {
      console.log('🌱 Seeding database from JSON data...');
      const { seedDatabase } = require('./seed');
      await seedDatabase();
      console.log('✅ Database seeded successfully!');
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

module.exports = {
  DB_TYPE,
  query,
  get,
  run,
  exec,
  initDb,
  getSqliteDb,
};
