// ==========================================================
// crwn.st Server-Side Template View Routes (EJS Engine)
// ==========================================================

const express = require('express');
const router = express.Router();
const { get } = require('../database/db');
const { getCurrentUser } = require('../middleware/auth');
const { resolveRoom } = require('../utils/roomResolver');
const { roomOccupancy } = require('../utils/roomOccupancy');
const catalog = require('../services/catalog');
const receipts = require('../services/receipts');

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

// GET /login alias redirect to /
router.get('/login', (req, res) => {
  res.redirect('/');
});

// GET /customer/dashboard
router.get('/customer/dashboard', requireCustomer, async (req, res) => {
  try {
    const products = await catalog.listItemsWithImages();

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
  const rawRoomId = String(req.query.roomId || '').trim();
  if (!rawRoomId) {
    return res.redirect('/customer/dashboard');
  }
  const room = resolveRoom(rawRoomId);
  if (!room) {
    return res.redirect('/customer/dashboard');
  }

  const roomId = room.barcode;
  const roomDisplay = room.display;

  // Gate: customer must hold this room in memory
  let active = roomOccupancy.get(room.roomNumber);
  if (!active || String(active.cusId) !== String(req.user.id)) {
    // If the room is occupied by someone else, redirect back with reason
    if (active && String(active.cusId) !== String(req.user.id)) {
      return res.redirect(`/customer/dashboard?roomOccupied=${encodeURIComponent(roomDisplay)}`);
    }
    // If the room is free, atomically acquire it for this customer
    const acquired = roomOccupancy.acquire(room.roomNumber, req.user.id);
    if (!acquired.ok && acquired.reason === 'CUSTOMER_IN_OTHER_ROOM') {
      return res.redirect(`/customer/dashboard?inOtherRoom=${encodeURIComponent(acquired.roomNumber)}`);
    }
    if (!acquired.ok) {
      return res.redirect(`/customer/dashboard?roomOccupied=${encodeURIComponent(roomDisplay)}`);
    }
    active = roomOccupancy.get(room.roomNumber);
  }
  roomOccupancy.touch(room.roomNumber, active.sessionId);
  const sessionId = active.sessionId;

  try {
    const products = await catalog.listItemsWithVariants();

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
  if (!user) {
    return res.redirect(`/?redirect=${encodeURIComponent(req.originalUrl)}`);
  }

  try {
    const receipt = await receipts.getReceiptWithLines(id);
    if (!receipts.canViewReceipt(receipt, user)) {
      return res.status(404).send('Receipt not found');
    }

    let customerName = 'ลูกค้าทั่วไป (Guest)';
    if (receipt.CUS_ID && receipt.CUS_ID !== 'guest') {
      const cus = await get(`SELECT CUS_FName, CUS_LName FROM CUSTOMER WHERE CUS_ID = ?`, [receipt.CUS_ID]);
      if (cus) {
        customerName = `${cus.CUS_FName} ${cus.CUS_LName}`;
      }
    }

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
