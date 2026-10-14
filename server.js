// ==========================================================
// crwn.st Express.js Application Server
// Built with Node.JS, Express.JS, EJS & MySQL DB
// ==========================================================

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();
const { initDb } = require('./database/db');
const { getCurrentUser } = require('./middleware/auth');

const COOKIE_SECRET = process.env.COOKIE_SECRET;
if (!COOKIE_SECRET || COOKIE_SECRET.length < 32) {
  console.error('❌ COOKIE_SECRET is missing or shorter than 32 chars. Set it in .env (see .env.example).');
  process.exit(1);
}

const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const viewRoutes = require('./routes/views');

const app = express();
const PORT = process.env.PORT || 3000;

// View engine setup (EJS with partial templates)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.disable('x-powered-by');

// Middlewares
app.use(compression()); // Compress all HTTP responses (Gzip/Deflate)
app.use(cors({ origin: false })); // same-origin only
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(cookieParser(COOKIE_SECRET));

// Security headers + camera permission for barcode scanning
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self)');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Expose minimal identity to templates (cookie is httpOnly, so JS cannot read it)
app.use((req, res, next) => {
  const u = getCurrentUser(req);
  res.locals.currentUser = u ? { id: u.id, role: u.role } : null;
  next();
});

// Static assets with cache control (no cache in dev to prevent stale scripts)
const isDev = process.env.NODE_ENV !== 'production';
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: isDev ? 0 : '1d',
  etag: true
}));

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
