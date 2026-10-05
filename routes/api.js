// ==========================================================
// crwn.st REST Web Services & API Endpoints
// MySQL — 10-table schema
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get, run, withTransaction } = require('../database/db');
const { getCurrentUser } = require('./auth');
const { getProductMockImage } = require('../utils/productImages');

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
      `SELECT l.PAY_ITEM_ID, l.ITV_SKUID, i.ITM_Name, i.ITM_Price, v.ITV_Color, v.ITV_Size
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
          name: l.ITM_Name,
          price: l.ITM_Price,
          color: l.ITV_Color,
          size: l.ITV_Size,
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

  try {
    const cartId = 'cart_' + cusId;
    await run(`INSERT IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);

    // Clear old items
    await run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, [cartId]);

    // Insert new items (1 row per quantity unit since no QTY column)
    if (Array.isArray(items)) {
      let rowIdx = 0;
      for (const item of items) {
        let sku = item.sku;
        const v = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [sku]);
        if (!v) {
          throw new Error('INVALID_SKU');
        }
        const qty = item.quantity || 1;
        for (let q = 0; q < qty; q++) {
          const lineId = `pitem_${cartId}_${rowIdx}_${Date.now()}`;
          await run(
            `INSERT IGNORE INTO PAY_CART_ITEM (PAY_ITEM_ID, PAY_CART_ID, ITV_SKUID) VALUES (?, ?, ?)`,
            [lineId, cartId, sku]
          );
          rowIdx++;
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cart' });
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

const ROOM_BARCODES = ['5684848452325', '5684848452326', '5684848452327', '5684848452328'];
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

function normalizeRoomId(id) {
  const s = String(id || '1').trim();
  if (s === '1') return '5684848452325';
  if (s === '2') return '5684848452326';
  if (s === '3') return '5684848452327';
  if (s === '4') return '5684848452328';
  return s;
}

function getRoomDisplayNumber(id) {
  const s = String(id || '1').trim();
  return ROOM_MAP[s] || s.replace(/^568484845232/, '') || s;
}

// GET /api/fitting-orders
// Defect-4 fix: supports ?limit=N to cap complete orders (default unlimited)
// Defect-6 fix: supports ?myOnly=true so staff sees only their own orders
// Item 3 fix: exclude dummy occupancy rows (ITV_SKUID IS NOT NULL)
router.get('/fitting-orders', async (req, res) => {
  const { roomId, limit, myOnly } = req.query;
  const user = getCurrentUser(req);
  try {
    let sql = `
      SELECT f.FTR_OrderID as id,
             CASE 
               WHEN f.FTR_FinishTime IS NOT NULL THEN 'complete'
               WHEN f.EMP_ID IS NOT NULL THEN 'preparing'
               ELSE 'pending'
             END as status,
             f.FTR_OrderTime as createdAt,
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
       LEFT JOIN ITEM_VARIANT v ON f.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       LEFT JOIN EMPLOYEE e ON f.EMP_ID = e.EMP_ID
    `;
    const params = [];
    const conditions = [];

    // Filter out dummy occupancy records so they never show as pending orders
    conditions.push(`f.ITV_SKUID IS NOT NULL AND f.ITV_SKUID != ''`);

    if (roomId) {
      const normRoom = normalizeRoomId(roomId);
      conditions.push(`(f.FTR_Number = ? OR f.FTR_Number = ?)`);
      params.push(normRoom, String(roomId));
    }

    // Defect-6 & Defect-1: filter by current staff employee AND unassigned orders when myOnly=true
    if (myOnly === 'true' && user && user.role !== 'CUSTOMER' && user.id) {
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
        f.FTR_OrderTime DESC,
        f.FTR_OrderID DESC
    `;

    let orders = await query(sql, params);

    // Decorate with roomDisplay and image
    orders.forEach(o => {
      o.roomDisplay = getRoomDisplayNumber(o.roomId);
      o.image = getProductMockImage(o.tag, o.productId);
    });

    // Defect-4: cap complete orders to the N most recent when limit param is provided
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
// Returns room list with 13-digit barcode and clean 1-4 room numbers
router.get('/fitting-rooms', async (req, res) => {
  try {
    const presenceRows = await query(`
      SELECT DISTINCT FTR_Number as roomNum, FTR_CustomerPresent
      FROM FITTING_ROOM
      WHERE FTR_CustomerPresent = 1
    `).catch(() => []);

    const presentSet = new Set(presenceRows.map(r => String(r.roomNum)));

    let fallbackOccupied = new Set();
    if (presenceRows.length === 0) {
      const activeOrders = await query(`
        SELECT FTR_Number as roomNum FROM FITTING_ROOM
        WHERE FTR_FinishTime IS NULL
      `);
      for (const r of activeOrders) fallbackOccupied.add(String(r.roomNum));
    }

    const rooms = [];
    for (let i = 0; i < ROOM_BARCODES.length; i++) {
      const roomNumStr = ROOM_BARCODES[i];
      const shortNum = String(i + 1);
      const isOccupied = presentSet.has(roomNumStr) || presentSet.has(shortNum) || fallbackOccupied.has(roomNumStr) || fallbackOccupied.has(shortNum);
      rooms.push({
        FTR_Num: roomNumStr,
        roomNumber: shortNum,
        roomDisplay: shortNum,
        FTR_Status: isOccupied ? 'occupied' : 'available',
        isOccupied,
        occupantName: isOccupied ? 'กำลังลองชุด' : null
      });
    }

    res.json(rooms);
  } catch (err) {
    console.error('Error fetching fitting rooms:', err);
    res.status(500).json({ error: 'Failed to fetch fitting rooms' });
  }
});

// POST /api/fitting-rooms/:roomId/enter
router.post('/fitting-rooms/:roomId/enter', async (req, res) => {
  const rawRoomId = req.params.roomId;
  const roomId = normalizeRoomId(rawRoomId);
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.status(403).json({ error: 'Forbidden — customer session required' });
  }
  try {
    const updateRes = await run(
      `UPDATE FITTING_ROOM SET FTR_CustomerPresent = 1 WHERE (FTR_Number = ? OR FTR_Number = ?) AND FTR_FinishTime IS NULL`,
      [roomId, rawRoomId]
    ).catch(() => ({ changes: 0 }));

    if (!updateRes || updateRes.changes === 0) {
      const dummyId = 'occ_' + Date.now();
      await run(
        `INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, FTR_FinishTime, FTR_CustomerPresent) VALUES (?, NULL, NULL, ?, NULL, 1)`,
        [dummyId, roomId]
      ).catch(() => {});
    }

    res.json({ success: true, roomId, customerPresent: true });
  } catch (err) {
    console.error('Error entering room:', err);
    res.status(500).json({ error: 'Failed to mark room entry' });
  }
});

// POST /api/fitting-rooms/:roomId/release
router.post('/fitting-rooms/:roomId/release', async (req, res) => {
  const rawRoomId = req.params.roomId;
  const roomId = normalizeRoomId(rawRoomId);
  try {
    await run(
      `UPDATE FITTING_ROOM SET FTR_FinishTime = NOW(), FTR_CustomerPresent = 0 WHERE (FTR_Number = ? OR FTR_Number = ?) AND FTR_FinishTime IS NULL`,
      [roomId, rawRoomId]
    );
    // Delete any dummy rows that were released
    await run(`DELETE FROM FITTING_ROOM WHERE (FTR_Number = ? OR FTR_Number = ?) AND ITV_SKUID IS NULL`, [roomId, rawRoomId]).catch(() => {});
    res.json({ success: true, roomId });
  } catch (err) {
    console.error('Error releasing room:', err);
    res.status(500).json({ error: 'Failed to release fitting room' });
  }
});

// POST /api/fitting-orders
// Defect-1 fix: strict SKU validation — no fallback to first variant
router.post('/fitting-orders', async (req, res) => {
  const { roomId, sku, productName, size, color } = req.body;

  // Validate that a SKU was provided
  if (!sku || !String(sku).trim()) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_SKU', message: 'กรุณาระบุ SKU ของสินค้าที่ต้องการลอง' }
    });
  }

  try {
    const roomNum = String(roomId || '1');
    const targetSku = String(sku).trim();

    // Strict lookup — reject if SKU not found (Defect-1: no fallback chain)
    const variant = await get(
      `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_Name 
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

    const orderId = 'fo_' + Date.now();

    await run(
      `INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number) VALUES (?, ?, NULL, ?)`,
      [orderId, targetSku, roomNum]
    );

    // Retrieve rich details for newly created order
    const created = await get(`
      SELECT f.FTR_OrderID as id,
             'pending' as status,
             f.FTR_OrderTime as createdAt,
             f.FTR_Number as roomId,
             f.ITV_SKUID as sku,
             COALESCE(v.ITV_Size, ?) as size,
             COALESCE(v.ITV_Color, ?) as color,
             COALESCE(i.ITM_Name, ?) as productName,
             COALESCE(i.ITM_Price, 0) as price
       FROM FITTING_ROOM f
       LEFT JOIN ITEM_VARIANT v ON f.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE f.FTR_OrderID = ?
    `, [size || '-', color || '-', productName || 'เสื้อผ้าสำหรับลอง', orderId]);

    res.json(created || {
      id: orderId,
      roomId: roomNum,
      sku: targetSku,
      productName: productName || 'เสื้อผ้าสำหรับลอง',
      size: size || '-',
      color: color || '-',
      status: 'pending',
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Create fitting order error:', err);
    res.status(500).json({ error: 'Failed to create fitting order' });
  }
});

// PATCH /api/fitting-orders/:id
// Defect-6 fix: verify that the requesting staff owns the order before allowing mutation
router.patch('/fitting-orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, empId } = req.body;
  const user = getCurrentUser(req);
  const staffId = empId || (user && user.role !== 'CUSTOMER' ? user.id : '68070056');

  const cleanStatus = String(status || '').trim().toLowerCase();
  if (!['pending', 'preparing', 'complete'].includes(cleanStatus)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง (Invalid status)' });
  }

  try {
    // Fetch the order to check EMP_ID ownership (Defect-6)
    const existing = await get(`SELECT EMP_ID FROM FITTING_ROOM WHERE FTR_OrderID = ?`, [id]);
    if (!existing) {
      return res.status(404).json({ error: 'ไม่พบคำสั่งซื้อนี้ในระบบ' });
    }

    // If the order is already assigned to another staff, deny mutation from a different staff
    if (
      existing.EMP_ID &&
      user &&
      user.role !== 'CUSTOMER' &&
      String(existing.EMP_ID) !== String(staffId)
    ) {
      return res.status(403).json({
        error: 'Forbidden — คุณไม่ได้รับมอบหมายให้ดูแล order นี้ ไม่สามารถแก้ไขได้'
      });
    }

    if (cleanStatus === 'preparing') {
      // Set EMP_ID to mark as preparing
      await run(
        `UPDATE FITTING_ROOM SET EMP_ID = ? WHERE FTR_OrderID = ?`,
        [staffId, id]
      );
    } else if (cleanStatus === 'complete') {
      // Set FTR_FinishTime to mark as complete
      await run(
        `UPDATE FITTING_ROOM SET FTR_FinishTime = NOW() WHERE FTR_OrderID = ?`,
        [id]
      );
    } else if (cleanStatus === 'pending') {
      // Reset to pending
      await run(
        `UPDATE FITTING_ROOM SET EMP_ID = NULL, FTR_FinishTime = NULL WHERE FTR_OrderID = ?`,
        [id]
      );
    }
    res.json({ success: true, id, status: cleanStatus });
  } catch (err) {

    console.error('Update fitting order error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================================
// 4. SALE ORDERS & RECEIPTS (SALE_ORDER & SALE_ORDER_LINE)
// ==========================================================

// GET /api/receipts
router.get('/receipts', async (req, res) => {
  try {
    const orders = await query(`SELECT * FROM SALE_ORDER ORDER BY ORD_DateTime DESC`);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// GET /api/receipts/:id
router.get('/receipts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await get(`SELECT * FROM SALE_ORDER WHERE ORD_ID = ?`, [id]);
    if (!order) {
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
router.post('/receipts', async (req, res) => {
  const { paymentMethod, items, memberId, channel } = req.body;
  const user = getCurrentUser(req);
  const cusId = memberId || (user && user.role === 'CUSTOMER' ? user.id : null);
  const empId = (user && user.role === 'CASHIER') ? user.id : '68070254';
  const orderChannel = channel || (user && user.role === 'CASHIER' ? 'pos_cashier' : 'customer_pay_and_go');

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

      // 2. Insert SALE_ORDER with server-calculated total (Subtotal + 7% VAT)
      const vatAmount = calculatedTotal * 0.07;
      const totalWithVat = calculatedTotal + vatAmount;
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

// GET /api/users
router.get('/users', async (req, res) => {
  try {
    const customers = await query(
      `SELECT CUS_ID as id, CONCAT(CUS_FName, ' ', CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
       FROM CUSTOMER`
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
