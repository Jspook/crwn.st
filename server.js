// ==========================================================
// crwn.st Express.js Application Server
// Built with Node.JS, Express.JS, EJS & SQLite/MySQL DB
// ==========================================================

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { initDb } = require('./database/db');

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/views');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup (EJS with partial templates)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static assets
app.use(express.static(path.join(__dirname, 'public')));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).render('index', {
    user: null,
    error: 'ไม่พบหน้าที่คุณต้องการ (404 Not Found)'
  });
});

// Start server after DB initialized
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`crwn.st server running smoothly at http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = app;
