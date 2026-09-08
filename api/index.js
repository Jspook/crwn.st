// ==========================================================
// Vercel Serverless Function Entry Point
// ==========================================================

const app = require('../server');
const { initDb } = require('../database/db');

let isInitialized = false;

module.exports = async (req, res) => {
  if (!isInitialized) {
    try {
      await initDb();
      isInitialized = true;
    } catch (err) {
      console.error('Database initialization error on Vercel:', err);
    }
  }
  return app(req, res);
};
