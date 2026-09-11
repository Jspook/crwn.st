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
let dataDir;
if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
  dataDir = path.join('/tmp', 'data');
} else {
  dataDir = path.join(__dirname, '..', 'data');
}

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (e) {
  dataDir = path.join('/tmp', 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

function getSqliteDb() {
  if (!sqliteDb) {
    const dbPath = path.join(dataDir, 'crwn_store.db');

    // If running in /tmp and a bundled template DB exists in project, copy it over
    const templateDbPath = path.join(__dirname, '..', 'data', 'crwn_store.db');
    if (dataDir.startsWith('/tmp') && !fs.existsSync(dbPath) && fs.existsSync(templateDbPath)) {
      try {
        fs.copyFileSync(templateDbPath, dbPath);
      } catch (err) {
        console.warn('Could not copy seed DB to /tmp, will initialize from scratch:', err);
      }
    }

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
 * Execute a callback within a database transaction (supports both SQLite and MySQL)
 * callback receives a tx object with { query, get, run } methods
 */
async function withTransaction(callback) {
  if (DB_TYPE === 'mysql') {
    const pool = getMysqlPool();
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
  } else {
    const db = getSqliteDb();
    db.prepare('BEGIN IMMEDIATE').run();
    const tx = {
      query: async (sql, params = []) => {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
      },
      get: async (sql, params = []) => {
        const stmt = db.prepare(sql);
        const row = stmt.get(...params);
        return row || null;
      },
      run: async (sql, params = []) => {
        const stmt = db.prepare(sql);
        const result = stmt.run(...params);
        return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      }
    };
    try {
      const result = await callback(tx);
      db.prepare('COMMIT').run();
      return result;
    } catch (err) {
      try {
        db.prepare('ROLLBACK').run();
      } catch (rollbackErr) {
        // Ignored if already rolled back
      }
      throw err;
    }
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

    // Ensure requested staff IDs exist in EMPLOYEE table
    await run(
      `INSERT OR REPLACE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) 
       VALUES ('68070254', 'แคชเชียร์', '(POS)', '0891234567', 'cashier@crwn.st', '68070254', 'CASHIER')`
    );
    await run(
      `INSERT OR REPLACE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) 
       VALUES ('68070056', 'พนักงาน', 'ห้องลอง', '0891234567', 'fitting@crwn.st', '68070056', 'FITTING_STAFF')`
    );
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
  withTransaction,
  initDb,
  getSqliteDb,
};
