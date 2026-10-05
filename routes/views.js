// ==========================================================
// crwn.st Server-Side Template View Routes (EJS Engine)
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');
const { getCurrentUser } = require('./auth');
const { getProductMockImage } = require('../utils/productImages');

// Middleware to ensure customer session
function requireCustomer(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.redirect(`/?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  if (user.role !== 'CUSTOMER') {
    if (user.role === 'CASHIER') return res.redirect('/staff/cashier');
    if (user.role === 'FITTING_STAFF') return res.redirect('/staff/fitting');
    return res.redirect('/');
  }
  req.user = user;
  next();
}

// Middleware to ensure staff session
function requireStaff(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.redirect(`/?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  if (user.role !== 'CASHIER' && user.role !== 'FITTING_STAFF') {
    return res.redirect('/customer/dashboard');
  }
  req.user = user;
  next();
}

// Middleware to ensure cashier session specifically
function requireCashier(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    return res.redirect(`/?redirect=${encodeURIComponent(req.originalUrl)}`);
  }
  if (user.role !== 'CASHIER') {
    if (user.role === 'FITTING_STAFF') return res.redirect('/staff/fitting');
    return res.redirect('/customer/dashboard');
  }
  req.user = user;
  next();
}

// GET / : Portal Login Page
router.get('/', (req, res) => {
  const user = getCurrentUser(req);
  if (user) {
    if (user.role === 'CUSTOMER') return res.redirect('/customer/dashboard');
    if (user.role === 'CASHIER') return res.redirect('/staff/cashier');
    if (user.role === 'FITTING_STAFF') return res.redirect('/staff/fitting');
  }
  res.render('index', { user: null });
});

// GET /customer/dashboard
router.get('/customer/dashboard', requireCustomer, async (req, res) => {
  try {
    const products = await query(`SELECT * FROM ITEM ORDER BY ITM_ID ASC`);
    products.forEach(p => {
      p.image = getProductMockImage(p.ITM_Tag, p.ITM_ID);
    });
    res.render('customer/dashboard', {
      user: req.user,
      products
    });
  } catch (err) {
    console.error(err);
    res.render('customer/dashboard', { user: req.user, products: [] });
  }
});

// GET /customer/fitting-room
router.get('/customer/fitting-room', requireCustomer, async (req, res) => {
  const roomId = String(req.query.roomId || '1').trim();
  const ROOM_MAP = {
    '5684848452325': '1',
    '5684848452326': '2',
    '5684848452327': '3',
    '5684848452328': '4',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4'
  };
  const roomDisplay = ROOM_MAP[roomId] || roomId.replace(/^568484845232/, '') || roomId;

  function normalizeRoomId(id) {
    const s = String(id || '1').trim();
    if (s === '1') return '5684848452325';
    if (s === '2') return '5684848452326';
    if (s === '3') return '5684848452327';
    if (s === '4') return '5684848452328';
    return s;
  }
  const normRoom = normalizeRoomId(roomId);

  try {
    const active = await get(`SELECT FTR_SessionID FROM FITTING_ROOM WHERE (FTR_Number = ? OR FTR_Number = ?) AND CUS_ID = ? AND FTR_CustomerPresent = 1 AND FTR_ReleasedAt IS NULL LIMIT 1`, [normRoom, String(roomId), req.user.id]);
    if (!active) {
      return res.redirect('/customer/dashboard');
    }
    const sessionId = active.FTR_SessionID;

    const products = await query(`SELECT * FROM ITEM ORDER BY ITM_ID ASC`);
    const variants = await query(`SELECT * FROM ITEM_VARIANT`);

    // Attach variants to products
    const map = {};
    for (const v of variants) {
      if (!map[v.ITM_ID]) map[v.ITM_ID] = [];
      map[v.ITM_ID].push({
        sku: v.ITV_SKUID,
        color: v.ITV_Color,
        size: v.ITV_Size,
        stock: v.ITV_Stock
      });
    }

    products.forEach(p => {
      p.variants = map[p.ITM_ID] || [];
      p.image = getProductMockImage(p.ITM_Tag, p.ITM_ID);
    });

    res.render('customer/fitting-room', {
      user: req.user,
      roomId,
      roomDisplay,
      sessionId,
      products
    });
  } catch (err) {
    console.error(err);
    res.render('customer/fitting-room', { user: req.user, roomId, roomDisplay, sessionId: '', products: [] });
  }
});

// GET /customer/checkout
router.get('/customer/checkout', requireCustomer, (req, res) => {
  res.render('customer/checkout', {
    user: req.user
  });
});

// GET /customer/receipt/:id
router.get('/customer/receipt/:id', async (req, res) => {
  const user = getCurrentUser(req);
  const { id } = req.params;

  try {
    const receipt = await get(`SELECT * FROM SALE_ORDER WHERE ORD_ID = ?`, [id]);
    if (!receipt) {
      return res.status(404).send('Receipt not found');
    }

    let customerName = 'ลูกค้าทั่วไป (Guest)';
    if (receipt.CUS_ID && receipt.CUS_ID !== 'guest') {
      const cus = await get(`SELECT CUS_FName, CUS_LName FROM CUSTOMER WHERE CUS_ID = ?`, [receipt.CUS_ID]);
      if (cus) {
        customerName = `${cus.CUS_FName} ${cus.CUS_LName}`;
      }
    }

    const items = await query(
      `SELECT l.*, v.ITV_Color, v.ITV_Size, i.ITM_Name
       FROM SALE_ORDER_LINE l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.ORD_ID = ?`,
      [id]
    );

    receipt.items = items;
    receipt.customerName = customerName;

    res.render('customer/receipt', {
      user,
      receipt
    });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error loading receipt');
  }
});

// GET /staff
router.get('/staff', requireStaff, (req, res) => {
  res.render('staff/index', {
    user: req.user
  });
});

// GET /staff/cashier
router.get('/staff/cashier', requireCashier, (req, res) => {
  res.render('staff/cashier', {
    user: req.user
  });
});

// GET /staff/fitting
router.get('/staff/fitting', requireStaff, (req, res) => {
  res.render('staff/fitting', {
    user: req.user
  });
});

module.exports = router;
