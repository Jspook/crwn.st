// ==========================================================
// crwn.st Server-Side Template View Routes (EJS Engine)
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get } = require('../database/db');
const { getCurrentUser } = require('./auth');

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
  try {
    // 1. Verify room status - check if occupied by someone else
    const room = await get(`SELECT * FROM FITTING_ROOM WHERE FTR_Num = ?`, [roomId]);
    if (!room) {
      return res.redirect('/customer/dashboard?roomError=not_found');
    }

    let activeSession = await get(
      `SELECT * FROM FITTING_SESSION WHERE FTR_NUM = ? ORDER BY FTS_DateTime DESC LIMIT 1`,
      [roomId]
    );

    if (room.FTR_Status === 'occupied') {
      if (!activeSession || activeSession.CUS_ID !== req.user.id) {
        // Room is currently in use by another customer or locked: redirect back to dashboard
        return res.redirect(`/customer/dashboard?roomOccupied=${roomId}`);
      }
    } else {
      // If room was available, mark occupied and create a fresh session for this customer
      const newSessionId = `fts_${roomId}_${Date.now()}`;
      await run(`UPDATE FITTING_ROOM SET FTR_Status = 'occupied' WHERE FTR_Num = ?`, [roomId]);
      await run(
        `INSERT INTO FITTING_SESSION (FTS_ID, FTR_NUM, CUS_ID, FTS_DateTime) VALUES (?, ?, ?, ?)`,
        [newSessionId, roomId, req.user.id, new Date().toISOString()]
      );
      activeSession = { FTS_ID: newSessionId, FTR_NUM: roomId, CUS_ID: req.user.id };
    }

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
    });

    res.render('customer/fitting-room', {
      user: req.user,
      roomId,
      sessionId: activeSession ? activeSession.FTS_ID : '',
      products
    });
  } catch (err) {
    console.error(err);
    res.render('customer/fitting-room', { user: req.user, roomId, products: [] });
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

    const items = await query(
      `SELECT l.*, v.ITV_Color, v.ITV_Size, i.ITM_Name, i.ITM_Image
       FROM SALE_ORDER_LINE l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.ORD_ID = ?`,
      [id]
    );

    receipt.items = items;

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
