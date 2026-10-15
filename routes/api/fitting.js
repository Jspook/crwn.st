// Fitting rooms & fitting orders (mounted under /api)
const express = require('express');
const router = express.Router();
const { getCurrentUser, requireAuth, requireRole } = require('../../middleware/auth');
const { resolveRoom } = require('../../utils/roomResolver');
const { roomOccupancy } = require('../../utils/roomOccupancy');
const fitting = require('../../services/fittingOrders');

// GET /api/fitting-orders
// Supports ?limit=N to cap complete orders, ?myOnly=true for staff
router.get('/fitting-orders', requireAuth, async (req, res) => {
  const { roomId, limit, myOnly } = req.query;
  const user = req.user;
  if (!['CUSTOMER', 'FITTING_STAFF'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
  // Customers are always scoped to one room's active session; never fall back to "all rooms".
  if (user.role === 'CUSTOMER' && !roomId) return res.status(400).json({ error: 'roomId is required' });
  try {
    if (user.role === 'CUSTOMER') {
      const room = resolveRoom(roomId);
      if (!room) return res.json([]);
      return res.json(await fitting.listOrdersForCustomer({ cusId: user.id, room, limit }));
    }
    res.json(await fitting.listOrdersForStaff({ staffId: user.id, myOnly: myOnly === 'true', limit }));
  } catch (err) {
    console.error('Error fetching fitting orders:', err);
    res.status(500).json({ error: 'Failed to fetch fitting orders' });
  }
});

// GET /api/fitting-rooms
router.get('/fitting-rooms', async (req, res) => {
  try {
    res.json(fitting.listRooms(getCurrentUser(req)));
  } catch (err) {
    console.error('Error fetching fitting rooms:', err);
    res.status(503).json({ error: 'Failed to fetch fitting rooms' });
  }
});

// POST /api/fitting-rooms/:roomId/enter
router.post('/fitting-rooms/:roomId/enter', async (req, res) => {
  const room = resolveRoom(req.params.roomId);
  if (!room) {
    return res.status(400).json({ error: 'รหัสห้องลองไม่ถูกต้อง (Invalid or unknown fitting room QR code)' });
  }

  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'กรุณาเข้าสู่ระบบก่อนสแกน QR Code (Customer session required)' });
  }

  // Occupancy is in server memory; acquire is synchronous so check-and-set is atomic.
  const acquired = roomOccupancy.acquire(room.roomNumber, user.id);
  if (!acquired.ok && acquired.reason === 'CUSTOMER_IN_OTHER_ROOM') {
    return res.status(409).json({
      error: `คุณใช้ห้องลองหมายเลข ${acquired.roomNumber} อยู่ กรุณาออกจากห้องนั้นก่อนเข้าห้องอื่น`,
      reason: 'CUSTOMER_IN_OTHER_ROOM',
      roomDisplay: acquired.roomNumber
    });
  }
  if (!acquired.ok) {
    return res.status(409).json({ error: 'ห้องลองนี้มีลูกค้าท่านอื่นใช้งานอยู่ กรุณาเลือกห้องอื่น' });
  }

  res.json({
    success: true,
    sessionId: acquired.sessionId,
    roomId: room.barcode,
    roomDisplay: room.display,
    customerPresent: true,
    resumed: acquired.resumed
  });
});

// POST /api/fitting-rooms/:roomId/release
// Staff force-release; customers may only release their own room/session (in-memory lock)
router.post('/fitting-rooms/:roomId/release', requireRole('CUSTOMER', 'FITTING_STAFF'), async (req, res) => {
  const room = resolveRoom(req.params.roomId);
  if (!room) {
    return res.status(400).json({ error: 'รหัสห้องลองไม่ถูกต้อง (Invalid fitting room)' });
  }

  const user = req.user;
  const result = user.role === 'CUSTOMER'
    ? roomOccupancy.release(room.roomNumber, { cusId: user.id, sessionId: req.body?.sessionId })
    : roomOccupancy.release(room.roomNumber, { force: true });

  if (!result.ok) {
    const error = result.reason === 'SESSION_MISMATCH'
      ? 'รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน (Session mismatch)'
      : 'Forbidden — no active fitting room session to release';
    return res.status(403).json({ error });
  }

  res.json({ success: true, roomId: room.barcode, roomDisplay: room.display });
});

// POST /api/fitting-orders
router.post('/fitting-orders', requireRole('CUSTOMER'), async (req, res) => {
  const { roomId, sku, size, color } = req.body;

  if (!sku || !String(sku).trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SKU', message: 'กรุณาระบุ SKU ของสินค้าที่ต้องการลอง' }
    });
  }

  const room = resolveRoom(roomId);
  if (!room) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROOM', message: 'รหัสห้องลองไม่ถูกต้อง' }
    });
  }

  try {
    const result = await fitting.createOrder({ cusId: req.user.id, room, sku, size, color });
    if (!result.ok) {
      return res.status(result.status).json({
        success: false,
        error: { code: result.code, message: result.message }
      });
    }
    res.json(result.order);
  } catch (err) {
    console.error('Create fitting order error:', err);
    res.status(500).json({ error: 'Failed to create fitting order' });
  }
});

// PATCH /api/fitting-orders/:id
router.patch('/fitting-orders/:id', requireRole('FITTING_STAFF'), async (req, res) => {
  try {
    const result = await fitting.transitionOrder({
      id: req.params.id,
      status: req.body.status,
      staffId: req.user.id
    });
    res.status(result.status || 200).json(result.body);
  } catch (err) {
    console.error('Update fitting order error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

module.exports = router;
