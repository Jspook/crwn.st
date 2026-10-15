// ==========================================================
// crwn.st REST Web Services & API Endpoints
// MySQL — 10-table schema
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get, run, withTransaction } = require('../database/db');
const { getCurrentUser, requireAuth, requireRole } = require('../middleware/auth');
const { getProductMockImage } = require('../utils/productImages');
const { resolveRoom, getCanonicalBarcode, getRoomDisplayNumber, getAllRooms } = require('../utils/roomResolver');
const fittingSessions = require('../utils/fittingSessions');

// ==========================================================
// 1. PRODUCTS & BARCODE LOOKUP
// ==========================================================

// GET /api/products (supports pagination with ?page=1&limit=12)
router.get('/products', async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit) || 12;
    const category = req.query.category;
    const search = req.query.search ? req.query.search.trim() : null;

    let itemsQuery = `SELECT * FROM ITEM`;
    let countQuery = `SELECT COUNT(*) as total FROM ITEM`;
    const params = [];
    const countParams = [];

    const conditions = [];
    if (category && category !== 'ALL') {
      conditions.push(`ITM_Category = ?`);
      params.push(category);
      countParams.push(category);
    }
    if (search) {
      conditions.push(`(ITM_Name LIKE ? OR ITM_Tag LIKE ?)`);
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ` + conditions.join(' AND ');
      itemsQuery += whereClause;
      countQuery += whereClause;
    }

    itemsQuery += ` ORDER BY ITM_ID ASC`;

    if (!isNaN(page) && page > 0) {
      const totalResult = await get(countQuery, countParams);
      const total = totalResult ? totalResult.total : 0;
      const offset = (page - 1) * limit;
      itemsQuery += ` LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const items = await query(itemsQuery, params);
      const variants = await query(`SELECT * FROM ITEM_VARIANT`);

      const variantMap = {};
      for (const v of variants) {
        if (!variantMap[v.ITM_ID]) variantMap[v.ITM_ID] = [];
        variantMap[v.ITM_ID].push({
          sku: v.ITV_SKUID,
          color: v.ITV_Color,
          size: v.ITV_Size,
          stock: v.ITV_Stock,
          locationId: v.LOC_ID
        });
      }

      const result = items.map(item => ({
        id: item.ITM_ID,
        ITM_ID: item.ITM_ID,
        name: item.ITM_Name,
        ITM_Name: item.ITM_Name,
        description: item.ITM_Description,
        price: item.ITM_Price,
        ITM_Price: item.ITM_Price,
        category: item.ITM_Category,
        ITM_Category: item.ITM_Category,
        tag: item.ITM_Tag,
        image: getProductMockImage(item.ITM_Tag, item.ITM_ID),
        variants: variantMap[item.ITM_ID] || []
      }));

      return res.json({
        data: result,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1
        }
      });
    }

    // Default without page param: return full array
    const items = await query(itemsQuery, params);
    const variants = await query(`SELECT * FROM ITEM_VARIANT`);

    // Group variants by item
    const variantMap = {};
    for (const v of variants) {
      if (!variantMap[v.ITM_ID]) variantMap[v.ITM_ID] = [];
      variantMap[v.ITM_ID].push({
        sku: v.ITV_SKUID,
        color: v.ITV_Color,
        size: v.ITV_Size,
        stock: v.ITV_Stock,
        locationId: v.LOC_ID
      });
    }

    const result = items.map(item => ({
      id: item.ITM_ID,
      ITM_ID: item.ITM_ID,
      name: item.ITM_Name,
      ITM_Name: item.ITM_Name,
      description: item.ITM_Description,
      price: item.ITM_Price,
      ITM_Price: item.ITM_Price,
      category: item.ITM_Category,
      ITM_Category: item.ITM_Category,
      tag: item.ITM_Tag,
      image: getProductMockImage(item.ITM_Tag, item.ITM_ID),
      variants: variantMap[item.ITM_ID] || []
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/barcode/:code
router.get('/products/barcode/:code', async (req, res) => {
  const code = req.params.code.trim();
  try {
    // 1. Try finding matching variant by SKU
    let variant = await get(
      `SELECT v.*, i.ITM_Name, i.ITM_Price, i.ITM_Category, i.ITM_Description, i.ITM_Tag
       FROM ITEM_VARIANT v
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE v.ITV_SKUID = ?`,
      [code]
    );

    // 2. If not found, try finding by ITM_ID
    if (!variant) {
      const item = await get(`SELECT * FROM ITEM WHERE ITM_ID = ?`, [code]);
      if (item) {
        const itemVariants = await query(`SELECT * FROM ITEM_VARIANT WHERE ITM_ID = ?`, [code]);
        return res.json({
          id: item.ITM_ID,
          name: item.ITM_Name,
          price: item.ITM_Price,
          category: item.ITM_Category,
          tag: item.ITM_Tag,
          image: getProductMockImage(item.ITM_Tag, item.ITM_ID),
          variants: itemVariants.map(iv => ({
            sku: iv.ITV_SKUID,
            color: iv.ITV_Color,
            size: iv.ITV_Size,
            stock: iv.ITV_Stock
          }))
        });
      }
    }

    // Remove Fallback mechanism for barcode lookup (Defect 11)
    if (!variant) {
      return res.status(404).json({ error: 'ไม่พบสินค้าจากบาร์โค้ดนี้ (ห้ามมั่ว)' });
    }

    res.json({
      id: variant.ITM_ID,
      name: variant.ITM_Name,
      price: variant.ITM_Price,
      category: variant.ITM_Category,
      tag: variant.ITM_Tag,
      image: getProductMockImage(variant.ITM_Tag, variant.ITM_ID),
      variants: [{
        sku: variant.ITV_SKUID,
        color: variant.ITV_Color,
        size: variant.ITV_Size,
        stock: variant.ITV_Stock
      }]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Barcode lookup error' });
  }
});

// ==========================================================
// 2. CART (PAY_CART & PAY_CART_ITEM) — No QTY column
// ==========================================================

// GET /api/cart
router.get('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ items: [] });
  }
  const cusId = user.id;

  try {
    let cart = await get(`SELECT PAY_CART_ID FROM PAY_CART WHERE CUS_ID = ?`, [cusId]);
    if (!cart) {
      const cartId = 'cart_' + cusId;
      await run(`INSERT IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);
      return res.json({ items: [] });
    }

    const lines = await query(
      `SELECT l.PAY_ITEM_ID, l.ITV_SKUID, i.ITM_ID as productId, i.ITM_Name, i.ITM_Price, i.ITM_Tag as tag, v.ITV_Color, v.ITV_Size
       FROM PAY_CART_ITEM l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.PAY_CART_ID = ?`,
      [cart.PAY_CART_ID]
    );

    // Group by SKU to compute quantities (since no QTY column, 1 row = 1 piece)
    const grouped = {};
    for (const l of lines) {
      if (!grouped[l.ITV_SKUID]) {
        grouped[l.ITV_SKUID] = {
          sku: l.ITV_SKUID,
          productId: l.productId,
          name: l.ITM_Name,
          price: l.ITM_Price,
          color: l.ITV_Color,
          size: l.ITV_Size,
          tag: l.tag,
          image: getProductMockImage(l.tag, l.productId),
          quantity: 0
        };
      }
      grouped[l.ITV_SKUID].quantity += 1;
    }

    res.json({ items: Object.values(grouped) });
  } catch (err) {
    console.error(err);
    res.json({ items: [] });
  }
});

// POST /api/cart
router.post('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ success: true, message: 'Cart not stored for non-customer' });
  }
  const cusId = user.id;
  const { items } = req.body;

  if (items && !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items must be an array' });
  }

  try {
    const cartId = 'cart_' + cusId;
    await run(`INSERT IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);

    // Atomic cart replace: validate all SKUs first before clearing
    await withTransaction(async (tx) => {
      const crypto = require('crypto');
      const validItems = [];

      if (Array.isArray(items)) {
        for (const item of items) {
          const sku = String(item.sku || '').trim();
          if (!sku) continue;
          const v = await tx.get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [sku]);
          if (!v) {
            const err = new Error(`Invalid SKU: ${sku}`);
            err.status = 404;
            throw err;
          }
          const qty = parseInt(item.quantity, 10);
          if (isNaN(qty) || qty <= 0) {
            const err = new Error(`Invalid quantity for SKU ${sku}: must be a positive integer`);
            err.status = 400;
            throw err;
          }
          validItems.push({ sku, qty });
        }
      }

      // Clear old items inside transaction
      await tx.run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, [cartId]);

      // Insert validated items
      let rowIdx = 0;
      for (const { sku, qty } of validItems) {
        for (let q = 0; q < qty; q++) {
          const lineId = `pitem_${cartId}_${rowIdx}_${crypto.randomUUID().slice(0, 8)}`;
          await tx.run(
            `INSERT INTO PAY_CART_ITEM (PAY_ITEM_ID, PAY_CART_ID, ITV_SKUID) VALUES (?, ?, ?)`,
            [lineId, cartId, sku]
          );
          rowIdx++;
        }
      }
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update cart' });
  }
});

// DELETE /api/cart
router.delete('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ success: true });
  }
  const cusId = user.id;
  try {
    const cartId = 'cart_' + cusId;
    await run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, [cartId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

// ==========================================================
// 3. FITTING ROOM ORDERS (New schema: FITTING_ROOM table)
//    FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, FTR_OrderTime, FTR_FinishTime
//    Status derived: 
//      - FTR_FinishTime IS NULL AND EMP_ID IS NULL → pending
//      - FTR_FinishTime IS NULL AND EMP_ID IS NOT NULL → preparing
//      - FTR_FinishTime IS NOT NULL → complete
// ==========================================================

// ==========================================================
// 3. FITTING ROOM ORDERS (FITTING_ROOM table)
//    Canonical QR resolution via utils/roomResolver
// ==========================================================

// Helper alias for backward compatibility within api.js
function normalizeRoomId(id) {
  const resolved = resolveRoom(id);
  return resolved ? resolved.barcode : String(id || '').trim();
}

// GET /api/fitting-orders
// Supports ?limit=N to cap complete orders, ?myOnly=true for staff
router.get('/fitting-orders', requireAuth, async (req, res) => {
  const { roomId, limit, myOnly } = req.query;
  const user = req.user;
  if (!['CUSTOMER', 'FITTING_STAFF'].includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
  // Customers are always scoped to one room's active session; never fall back to "all rooms".
  if (user.role === 'CUSTOMER' && !roomId) return res.status(400).json({ error: 'roomId is required' });
  try {
    let sql = `
      SELECT f.FTR_OrderID as id,
             CASE 
               WHEN f.FTR_FinishTime IS NOT NULL THEN 'complete'
               WHEN f.EMP_ID IS NOT NULL THEN 'preparing'
               ELSE 'pending'
             END as status,
             f.FTR_OrderTime as createdAt,
             f.FTR_FinishTime as finishedAt,
             f.FTR_Number as roomId,
             f.ITV_SKUID as sku,
             f.EMP_ID as empId,
             COALESCE(v.ITV_Size, '-') as size,
             COALESCE(v.ITV_Color, '-') as color,
             COALESCE(i.ITM_Name, '\u0e40\u0e2a\u0e37\u0e49\u0e2d\u0e1c\u0e49\u0e32\u0e2a\u0e33\u0e2b\u0e23\u0e31\u0e1a\u0e25\u0e2d\u0e07') as productName,
             COALESCE(i.ITM_Price, 0) as price,
             i.ITM_Tag as tag,
             i.ITM_ID as productId,
             e.EMP_FName as staffName
       FROM FITTING_ROOM f
       JOIN FITTING_ROOM_SLOT slot ON slot.FTR_RoomNumber = f.FTR_Number AND slot.FTR_ActiveSessionID = f.FTR_SessionID
       JOIN FITTING_ROOM_SESSION s ON s.FTR_SessionID = f.FTR_SessionID
       LEFT JOIN ITEM_VARIANT v ON f.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       LEFT JOIN EMPLOYEE e ON f.EMP_ID = e.EMP_ID
    `;
    const params = [];
    const conditions = [];

    conditions.push(`f.ITV_SKUID IS NOT NULL AND f.ITV_SKUID != ''`);
    conditions.push('f.FTR_CancelledAt IS NULL AND s.FTR_EndedAt IS NULL');
    conditions.push('s.FTR_LastSeenAt >= DATE_SUB(NOW(), INTERVAL 45 MINUTE)');

    if (roomId) {
      const room = resolveRoom(roomId);
      if (!room) return res.status(400).json({ error: 'Invalid fitting room' });
      conditions.push('f.FTR_Number = ?');
      params.push(room.roomNumber);
      if (user.role === 'CUSTOMER') {
        const active = await fittingSessions.getActive(room.roomNumber);
        if (!active || String(active.CUS_ID) !== String(user.id)) {
          return res.status(409).json({ error: 'No active fitting room session' });
        }
        conditions.push('f.FTR_SessionID = ?');
        params.push(active.FTR_SessionID);
      }
    }

    if (user.role === 'CUSTOMER') {
      conditions.push('s.CUS_ID = ? AND f.CUS_ID = s.CUS_ID');
      params.push(user.id);
    } else if (myOnly === 'true' && user.id) {
      conditions.push(`(f.EMP_ID = ? OR f.EMP_ID IS NULL)`);
      params.push(user.id);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }

    sql += `
      ORDER BY 
        CASE 
          WHEN f.FTR_FinishTime IS NOT NULL THEN 3
          WHEN f.EMP_ID IS NOT NULL THEN 2
          ELSE 1
        END ASC,
        CASE
          WHEN f.FTR_FinishTime IS NOT NULL THEN f.FTR_FinishTime
          ELSE f.FTR_OrderTime
        END DESC,
        f.FTR_OrderID DESC
    `;

    let orders = await query(sql, params);

    // Decorate with roomDisplay and image
    orders.forEach(o => {
      o.roomDisplay = getRoomDisplayNumber(o.roomId) || o.roomId;
      o.image = getProductMockImage(o.tag, o.productId);
    });

    // Cap complete orders to the N most recent when limit param is provided
    const limitNum = parseInt(limit);
    if (!isNaN(limitNum) && limitNum > 0) {
      let completeCount = 0;
      orders = orders.filter(o => {
        if (String(o.status).toLowerCase() === 'complete') {
          completeCount++;
          return completeCount <= limitNum;
        }
        return true;
      });
    }

    res.json(orders);
  } catch (err) {
    console.error('Error fetching fitting orders:', err);
    res.status(500).json({ error: 'Failed to fetch fitting orders' });
  }
});

// GET /api/fitting-rooms
// Returns canonical room list with occupancy and resume capability for active owner
router.get('/fitting-rooms', async (req, res) => {
  try {
    const user = getCurrentUser(req);
    const activeRooms = new Map((await fittingSessions.listActive()).map(s => [s.FTR_RoomNumber, s]));
    const rooms = getAllRooms().map(room => {
      const occ = activeRooms.get(room.roomNumber);
      const isOccupied = !!occ;
      const isMyRoom = isOccupied && user && user.role === 'CUSTOMER' && String(occ.CUS_ID) === String(user.id);

      return {
        FTR_Num: room.barcode,
        roomNumber: room.roomNumber,
        roomDisplay: room.display,
        FTR_Status: isOccupied ? 'occupied' : 'available',
        isOccupied,
        isMyRoom,
        canResume: isMyRoom,
        occupantName: isMyRoom ? 'ห้องลองของคุณ (คลิกเพื่อกลับเข้าห้อง)' : (isOccupied ? 'กำลังลองชุด' : null)
      };
    });

    res.json(rooms);
  } catch (err) {
    console.error('Error fetching fitting rooms:', err);
    res.status(503).json({ error: 'Failed to fetch fitting rooms' });
  }
});

// POST /api/fitting-rooms/:roomId/enter
// Atomic enter / resume session flow (BUG-006 & BUG-001)
router.post('/fitting-rooms/:roomId/enter', async (req, res) => {
  const rawRoomId = req.params.roomId;
  const room = resolveRoom(rawRoomId);
  if (!room) {
    return res.status(400).json({ error: 'รหัสห้องลองไม่ถูกต้อง (Invalid or unknown fitting room QR code)' });
  }

  const roomId = room.barcode;
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'กรุณาเข้าสู่ระบบก่อนสแกน QR Code (Customer session required)' });
  }

  try {
    const acquired = await fittingSessions.acquire(room.roomNumber, user.id);
    if (!acquired.ok) {
      return res.status(409).json({ error: 'ห้องลองนี้มีลูกค้าท่านอื่นใช้งานอยู่ กรุณาเลือกห้องอื่น' });
    }
    res.json({
      success: true,
      sessionId: acquired.sessionId,
      roomId,
      roomDisplay: room.display,
      customerPresent: true,
      resumed: acquired.resumed
    });
  } catch (err) {
    console.error('Enter fitting room failed:', err);
    res.status(503).json({ error: 'Unable to verify fitting room session' });
  }
});

// POST /api/fitting-rooms/:roomId/release
// Explicit room release scoped strictly to active session (BUG-006 & BUG-001)
router.post('/fitting-rooms/:roomId/release', requireRole('CUSTOMER', 'FITTING_STAFF'), async (req, res) => {
  const rawRoomId = req.params.roomId;
  const room = resolveRoom(rawRoomId);
  if (!room) {
    return res.status(400).json({ error: 'รหัสห้องลองไม่ถูกต้อง (Invalid fitting room)' });
  }

  const roomId = room.barcode;
  const user = req.user;

  try {
    const result = user.role === 'CUSTOMER'
      ? await fittingSessions.release(room.roomNumber, { cusId: user.id, sessionId: req.body?.sessionId })
      : await fittingSessions.release(room.roomNumber, { force: true });
    if (!result.ok) {
      const error = result.reason === 'SESSION_MISMATCH'
        ? 'รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน (Session mismatch)'
        : 'Forbidden — no active fitting room session to release';
      return res.status(403).json({ error });
    }
    res.json({ success: true, roomId, roomDisplay: room.display });
  } catch (err) {
    console.error('Release fitting room failed:', err);
    res.status(503).json({ error: 'Unable to release fitting room' });
  }
});

// POST /api/fitting-orders
// Defect-1 & BUG-004 fix: strict SKU & size/color pair validation
router.post('/fitting-orders', requireRole('CUSTOMER'), async (req, res) => {
  const { roomId, sku, productName, size, color } = req.body;

  // Validate that a SKU was provided
  if (!sku || !String(sku).trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SKU', message: 'กรุณาระบุ SKU ของสินค้าที่ต้องการลอง' }
    });
  }

  const room = resolveRoom(roomId || '1');
  if (!room) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROOM', message: 'รหัสห้องลองไม่ถูกต้อง' }
    });
  }

  try {
    const roomNum = room.roomNumber;
    const targetSku = String(sku).trim();
    const user = req.user;

    const cusId = user.id;

    // Strict lookup: join variant and item
    const variant = await get(
      `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_Name, i.ITM_Price, i.ITM_Tag, i.ITM_ID 
       FROM ITEM_VARIANT v 
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
       WHERE v.ITV_SKUID = ?`,
      [targetSku]
    );

    if (!variant) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_SKU', message: `ไม่พบสินค้า SKU '${targetSku}' ในฐานข้อมูล` }
      });
    }

    // BUG-004 fix: Enforce pair invariant between requested size/color and DB variant
    if (size && variant.ITV_Size && String(size).trim().toLowerCase() !== String(variant.ITV_Size).trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VARIANT_MISMATCH',
          message: `ไซส์ '${size}' ที่เลือกไม่ตรงกับ SKU '${targetSku}' (${variant.ITV_Size})`
        }
      });
    }
    if (color && variant.ITV_Color && String(color).trim().toLowerCase() !== String(variant.ITV_Color).trim().toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VARIANT_MISMATCH',
          message: `สี '${color}' ที่เลือกไม่ตรงกับ SKU '${targetSku}' (${variant.ITV_Color})`
        }
      });
    }

    // Check stock
    if (variant && Number(variant.ITV_Stock) <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: `สินค้า '${variant.ITM_Name}' (${variant.ITV_Color || ''} - ${variant.ITV_Size || ''}) สินค้าหมดสต็อกชั่วคราว ไม่สามารถสั่งลองได้ (Stock: 0)`
        }
      });
    }

    const crypto = require('crypto');
    const orderId = 'fo_' + crypto.randomUUID();

    // Serialize insert with release on the durable room slot.
    const created = await fittingSessions.withLockedActive(room.roomNumber, { cusId }, (tx, active) =>
      tx.run(`INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, CUS_ID, FTR_SessionID)
        VALUES (?, ?, NULL, ?, ?, ?)`, [orderId, targetSku, roomNum, cusId, active.FTR_SessionID]));
    if (!created.ok) return res.status(403).json({ error: 'Forbidden — no active fitting room session' });

    res.json({
      id: orderId,
      roomId: roomNum,
      roomDisplay: room.display,
      sku: targetSku,
      productName: variant.ITM_Name,
      size: variant.ITV_Size,
      color: variant.ITV_Color,
      price: variant.ITM_Price,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Create fitting order error:', err);
    res.status(500).json({ error: 'Failed to create fitting order' });
  }
});

// PATCH /api/fitting-orders/:id
// Defect-6 & BUG-005 fix: immutable completion timestamp
router.patch('/fitting-orders/:id', requireRole('FITTING_STAFF'), async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const staffId = req.user.id;

  const cleanStatus = String(status || '').trim().toLowerCase();
  if (!['pending', 'preparing', 'complete'].includes(cleanStatus)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง (Invalid status)' });
  }

  try {
    const locator = await get('SELECT FTR_Number FROM FITTING_ROOM WHERE FTR_OrderID = ?', [id]);
    if (!locator) return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้ในระบบ' });
    const room = resolveRoom(locator.FTR_Number);
    if (!room) return res.status(409).json({ error: 'Invalid order room' });
    const changed = await fittingSessions.withLockedActive(room.roomNumber, {}, async (tx, active) => {
      const existing = await tx.get(`SELECT EMP_ID, FTR_FinishTime, FTR_CancelledAt, FTR_SessionID
        FROM FITTING_ROOM WHERE FTR_OrderID = ? FOR UPDATE`, [id]);
      if (!existing || existing.FTR_CancelledAt || existing.FTR_SessionID !== active.FTR_SessionID) return { error: 'STALE_ORDER' };
      if (existing.EMP_ID != null && String(existing.EMP_ID) !== String(staffId)) return { error: 'NOT_OWNER' };
      if (existing.FTR_FinishTime != null) {
        return cleanStatus === 'complete'
          ? { finishedAt: existing.FTR_FinishTime } // idempotent, never rewrite the timestamp
          : { error: 'COMPLETE_IMMUTABLE' };
      }
      if (cleanStatus === 'pending' || (cleanStatus === 'complete' && existing.EMP_ID == null) ||
          (cleanStatus === 'preparing' && existing.EMP_ID != null)) {
        return { error: 'INVALID_TRANSITION' };
      }
      let result;
      if (cleanStatus === 'preparing') {
        result = await tx.run(`UPDATE FITTING_ROOM SET EMP_ID = ?
          WHERE FTR_OrderID = ? AND FTR_SessionID = ? AND FTR_CancelledAt IS NULL
            AND EMP_ID IS NULL AND FTR_FinishTime IS NULL`, [staffId, id, active.FTR_SessionID]);
      } else {
        result = await tx.run(`UPDATE FITTING_ROOM SET FTR_FinishTime = NOW()
          WHERE FTR_OrderID = ? AND FTR_SessionID = ? AND FTR_CancelledAt IS NULL
            AND EMP_ID = ? AND FTR_FinishTime IS NULL`, [id, active.FTR_SessionID, staffId]);
      }
      if (result.changes !== 1) return { error: 'STALE_ORDER' };
      const updated = await tx.get('SELECT FTR_FinishTime FROM FITTING_ROOM WHERE FTR_OrderID = ?', [id]);
      return { finishedAt: updated?.FTR_FinishTime ?? null };
    });
    if (!changed.ok || changed.value.error) return res.status(409).json({ error: changed.value?.error || 'NOT_ACTIVE' });
    res.json({ success: true, id, status: cleanStatus, finishedAt: changed.value.finishedAt });
  } catch (err) {
    console.error('Update fitting order error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================================
// 4. SALE ORDERS & RECEIPTS (SALE_ORDER & SALE_ORDER_LINE)
// ==========================================================

// GET /api/receipts
router.get('/receipts', requireRole('CASHIER'), async (req, res) => {
  try {
    const orders = await query(`SELECT * FROM SALE_ORDER ORDER BY ORD_DateTime DESC`);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// GET /api/receipts/:id — owner (customer) or cashier only
router.get('/receipts/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const order = await get(`SELECT * FROM SALE_ORDER WHERE ORD_ID = ?`, [id]);
    const isOwner = order && req.user.role === 'CUSTOMER' && order.CUS_ID === req.user.id;
    if (!order || !(isOwner || req.user.role === 'CASHIER')) {
      // 404 for both cases to avoid receipt ID enumeration
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const lines = await query(
      `SELECT l.*, v.ITV_Color, v.ITV_Size, i.ITM_Name
       FROM SALE_ORDER_LINE l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.ORD_ID = ?`,
      [id]
    );

    order.items = lines;
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Receipt lookup error' });
  }
});

// POST /api/receipts
router.post('/receipts', requireRole('CUSTOMER', 'CASHIER'), async (req, res) => {
  const { paymentMethod, items, memberId } = req.body;
  const user = req.user;
  const isCashier = user.role === 'CASHIER';
  // Customers can only buy for themselves; cashiers may attach a member
  const cusId = isCashier ? (memberId ? String(memberId) : null) : user.id;
  const empId = isCashier ? user.id : null;
  const orderChannel = isCashier ? 'pos_cashier' : 'customer_pay_and_go';
  const ALLOWED_METHODS = ['cash', 'credit', 'qr'];
  if (paymentMethod && !ALLOWED_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_METHOD', message: 'Invalid payment method' } });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CART',
        message: 'ไม่มีรายการสินค้าในคำสั่งซื้อ กรุณาเลือกสินค้าก่อนชำระเงิน'
      }
    });
  }

  const orderId = 'rcpt_' + Date.now();

  try {
    const result = await withTransaction(async (tx) => {
      let calculatedTotal = 0;
      const verifiedLines = [];

      // 1. Aggregate items by SKU to prevent duplicate processing
      const aggregatedItems = {};
      for (const rawItem of items) {
        const sku = String(rawItem.sku || rawItem.id || '').trim();
        const qty = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
        if (!sku) {
          const err = new Error(`พบรายการสินค้าที่ไม่มีรหัส SKU`);
          err.code = 'INVALID_SKU';
          throw err;
        }
        aggregatedItems[sku] = (aggregatedItems[sku] || 0) + qty;
      }

      const uniqueSkus = Object.keys(aggregatedItems);

      // 2. Validate all items, check stock, calculate prices strictly from Database
      for (let idx = 0; idx < uniqueSkus.length; idx++) {
        const sku = uniqueSkus[idx];
        const quantity = aggregatedItems[sku];

        // Fetch authoritative product and variant data from DB
        const variant = await tx.get(
          `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_ID, i.ITM_Name, i.ITM_Price
           FROM ITEM_VARIANT v
           JOIN ITEM i ON v.ITM_ID = i.ITM_ID
           WHERE v.ITV_SKUID = ?`,
          [sku]
        );

        if (!variant) {
          const err = new Error(`ไม่พบสินค้ารหัส SKU '${sku}' ในฐานข้อมูล`);
          err.code = 'PRODUCT_NOT_FOUND';
          throw err;
        }

        // Check stock before deducting
        if (Number(variant.ITV_Stock) < quantity) {
          const err = new Error(
            `สินค้า '${variant.ITM_Name}' (${variant.ITV_Color || ''} - ${variant.ITV_Size || ''}) มีสต็อกไม่เพียงพอ (คงเหลือ ${variant.ITV_Stock} ชิ้น, ต้องการ ${quantity} ชิ้น)`
          );
          err.code = 'OUT_OF_STOCK';
          err.details = { sku, available: variant.ITV_Stock, requested: quantity, name: variant.ITM_Name };
          throw err;
        }

        // Atomic stock deduction
        const stockRes = await tx.run(
          `UPDATE ITEM_VARIANT SET ITV_Stock = ITV_Stock - ? WHERE ITV_SKUID = ? AND ITV_Stock >= ?`,
          [quantity, sku, quantity]
        );

        if (stockRes.changes === 0) {
          const err = new Error(
            `สินค้า '${variant.ITM_Name}' ถูกสั่งซื้อไปแล้ว สต็อกไม่เพียงพอ`
          );
          err.code = 'OUT_OF_STOCK';
          err.details = { sku, available: 0, requested: quantity, name: variant.ITM_Name };
          throw err;
        }

        const unitPrice = Number(variant.ITM_Price) || 0;
        const lineSubtotal = unitPrice * quantity;
        calculatedTotal += lineSubtotal;

        verifiedLines.push({
          sku,
          name: variant.ITM_Name,
          color: variant.ITV_Color,
          size: variant.ITV_Size,
          price: unitPrice,
          quantity,
          subtotal: lineSubtotal
        });
      }

      // 2. Insert SALE_ORDER with server-calculated total (VAT already included)
      const totalWithVat = calculatedTotal;
      const now = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace('T', ' ');
      await tx.run(
        `INSERT INTO SALE_ORDER (ORD_ID, CUS_ID, EMP_ID, ORD_Method, ORD_Channel, ORD_DateTime, ORD_Total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, cusId, empId, paymentMethod || 'credit', orderChannel, now, totalWithVat]
      );

      // 3. Insert SALE_ORDER_LINE for each verified item
      for (let idx = 0; idx < verifiedLines.length; idx++) {
        const line = verifiedLines[idx];
        const lineId = `line_${orderId}_${idx}`;
        await tx.run(
          `INSERT INTO SALE_ORDER_LINE (ORD_LINE_ID, ORD_ID, ITV_SKUID, ORD_LINE_UPrice, ORD_LINE_Qty)
           VALUES (?, ?, ?, ?, ?)`,
          [lineId, orderId, line.sku, line.price, line.quantity]
        );
      }

      // 4. Clean up any stored cart in database for this customer
      if (cusId) {
        await tx.run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, ['cart_' + cusId]).catch(() => {});
      }

      return {
        id: orderId,
        ORD_ID: orderId,
        total: calculatedTotal,
        subtotal: calculatedTotal,
        paymentMethod: paymentMethod || 'credit',
        createdAt: now,
        items: verifiedLines
      };
    });

    return res.json({
      success: true,
      ...result
    });
  } catch (err) {
    console.error('Order transaction error:', err);
    if (err.code === 'OUT_OF_STOCK') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: err.message,
          details: err.details || null
        }
      });
    }
    if (err.code === 'PRODUCT_NOT_FOUND' || err.code === 'INVALID_SKU') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง'
      }
    });
  }
});

// ==========================================================
// 5. USERS (MEMBER SEARCH FOR POS)
// ==========================================================

// GET /api/users?phone=08xxxxxxxx — cashier-only exact phone lookup (no bulk PII dump)
router.get('/users', requireRole('CASHIER'), async (req, res) => {
  const phone = String(req.query.phone || '').replace(/[-\s]/g, '');
  if (!/^\d{9,10}$/.test(phone)) {
    return res.json([]);
  }
  try {
    const customers = await query(
      `SELECT CUS_ID as id, CONCAT(CUS_FName, ' ', CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
       FROM CUSTOMER WHERE CUS_Tel = ? LIMIT 1`,
      [phone]
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
