// ==========================================================
// crwn.st REST Web Services & API Endpoints
// Fully integrated with 14-table ER Diagram database
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get, run, withTransaction } = require('../database/db');
const { getCurrentUser } = require('./auth');

// ==========================================================
// 1. PRODUCTS & BARCODE LOOKUP
// ==========================================================

// GET /api/products
router.get('/products', async (req, res) => {
  try {
    const items = await query(`SELECT * FROM ITEM`);
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
      image: item.ITM_Image,
      ITM_Image: item.ITM_Image,
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
      `SELECT v.*, i.ITM_Name, i.ITM_Price, i.ITM_Category, i.ITM_Image, i.ITM_Description
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
        const v = itemVariants[0] || {
          ITV_SKUID: `${item.ITM_ID}-std`,
          ITV_Color: 'Standard',
          ITV_Size: 'M',
          ITV_Stock: 10
        };
        return res.json({
          id: item.ITM_ID,
          name: item.ITM_Name,
          price: item.ITM_Price,
          category: item.ITM_Category,
          image: item.ITM_Image,
          variants: itemVariants.map(iv => ({
            sku: iv.ITV_SKUID,
            color: iv.ITV_Color,
            size: iv.ITV_Size,
            stock: iv.ITV_Stock
          }))
        });
      }
    }

    // 3. Fallback: Check if numeric barcode maps to any known products
    if (!variant) {
      // Map demo sample barcodes
      const barcodeMap = {
        '8901234567891': 'p1',
        '8901234567892': 'p2',
        '8901234567893': 'p3',
        '8901234567894': 'p4',
      };
      const mappedId = barcodeMap[code];
      if (mappedId) {
        const item = await get(`SELECT * FROM ITEM WHERE ITM_ID = ?`, [mappedId]);
        if (item) {
          const itemVariants = await query(`SELECT * FROM ITEM_VARIANT WHERE ITM_ID = ?`, [mappedId]);
          return res.json({
            id: item.ITM_ID,
            name: item.ITM_Name,
            price: item.ITM_Price,
            category: item.ITM_Category,
            image: item.ITM_Image,
            variants: itemVariants.map(iv => ({
              sku: iv.ITV_SKUID,
              color: iv.ITV_Color,
              size: iv.ITV_Size,
              stock: iv.ITV_Stock
            }))
          });
        }
      }
    }

    if (!variant) {
      return res.status(404).json({ error: 'ไม่พบสินค้าจากบาร์โค้ดนี้' });
    }

    res.json({
      id: variant.ITM_ID,
      name: variant.ITM_Name,
      price: variant.ITM_Price,
      category: variant.ITM_Category,
      image: variant.ITM_Image,
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
// 2. CART (PAY_CART & PAY_CART_ITEM)
// ==========================================================

// GET /api/cart
router.get('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ items: [] });
  }
  const cusId = user.id;

  try {
    // Check or create cart in PAY_CART table
    let cart = await get(`SELECT PAY_CART_ID FROM PAY_CART WHERE CUS_ID = ?`, [cusId]);
    if (!cart) {
      const cartId = 'cart_' + cusId;
      await run(`INSERT OR IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);
      return res.json({ items: [] });
    }

    const lines = await query(
      `SELECT l.*, i.ITM_Name, i.ITM_Price, i.ITM_Image, v.ITV_Color, v.ITV_Size
       FROM PAY_CART_ITEM l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.PAY_CART_ID = ?`,
      [cart.PAY_CART_ID]
    );

    const items = lines.map(l => ({
      sku: l.ITV_SKUID,
      name: l.ITM_Name,
      price: l.ITM_Price,
      image: l.ITM_Image,
      color: l.ITV_Color,
      size: l.ITV_Size,
      quantity: l.QTY || 1
    }));

    res.json({ items });
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
    await run(`INSERT OR IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);

    // Clear old items
    await run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, [cartId]);

    // Insert new items
    if (Array.isArray(items)) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const lineId = `pitem_${cartId}_${i}_${Date.now()}`;
        // Ensure SKU exists
        let sku = item.sku;
        const v = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [sku]);
        if (!v) {
          const firstV = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT LIMIT 1`);
          sku = firstV ? firstV.ITV_SKUID : 'p1-os-navy';
        }
        await run(
          `INSERT OR IGNORE INTO PAY_CART_ITEM (PAY_ITEM_ID, PAY_CART_ID, ITV_SKUID, QTY) 
           VALUES (?, ?, ?, ?)`,
          [lineId, cartId, sku, item.quantity || 1]
        );
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
// 3. FITTING ROOMS & SESSIONS
// ==========================================================

// GET /api/fitting-rooms
router.get('/fitting-rooms', async (req, res) => {
  try {
    const rooms = await query(`SELECT * FROM FITTING_ROOM ORDER BY FTR_Num ASC`);
    const user = getCurrentUser(req);
    const cusId = user && user.role === 'CUSTOMER' ? user.id : null;

    const enhanced = await Promise.all(rooms.map(async (r) => {
      let isMySession = false;
      let occupantName = null;
      if (r.FTR_Status === 'occupied') {
        const lastSession = await get(
          `SELECT s.*, c.CUS_FName, c.CUS_LName 
           FROM FITTING_SESSION s 
           LEFT JOIN CUSTOMER c ON s.CUS_ID = c.CUS_ID 
           WHERE s.FTR_NUM = ? 
           ORDER BY s.FTS_DateTime DESC LIMIT 1`,
          [r.FTR_Num]
        );
        if (lastSession) {
          occupantName = lastSession.CUS_FName ? `${lastSession.CUS_FName} ${lastSession.CUS_LName || ''}`.trim() : 'ลูกค้า';
          if (cusId && lastSession.CUS_ID === cusId) {
            isMySession = true;
          }
        }
      }
      return {
        ...r,
        occupantName,
        isMySession
      };
    }));

    res.json(enhanced);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load fitting rooms' });
  }
});

// POST /api/fitting-sessions
router.post('/fitting-sessions', async (req, res) => {
  const { roomNum } = req.body;
  const user = getCurrentUser(req);
  const cusId = user && user.role === 'CUSTOMER' ? user.id : 'u1';
  const num = String(roomNum || '1').trim();

  try {
    // 1. Check if room exists
    const room = await get(`SELECT * FROM FITTING_ROOM WHERE FTR_Num = ?`, [num]);
    if (!room) {
      return res.status(404).json({ error: `ไม่พบห้องลองหมายเลข ${num}` });
    }

    // 2. Check if room is already occupied
    if (room.FTR_Status === 'occupied') {
      const lastSession = await get(
        `SELECT * FROM FITTING_SESSION WHERE FTR_NUM = ? ORDER BY FTS_DateTime DESC LIMIT 1`,
        [num]
      );
      // Strictly prevent entering an occupied/locked room!
      if (!lastSession || lastSession.CUS_ID !== cusId) {
        return res.status(409).json({ 
          error: `ห้องลองหมายเลข ${num} ล็อกอยู่และกำลังมีผู้ใช้งานในขณะนี้ ไม่สามารถเข้าได้ กรุณาเลือกห้องที่ว่าง` 
        });
      }
      // If customer is returning to their own active session
      return res.json({ sessionId: lastSession.FTS_ID, roomNum: num, status: 'occupied', reentered: true });
    }

    // 3. Mark room occupied and create session
    const sessionId = `fts_${num}_${Date.now()}`;
    const now = new Date().toISOString();

    await run(`UPDATE FITTING_ROOM SET FTR_Status = 'occupied' WHERE FTR_Num = ?`, [num]);
    await run(
      `INSERT INTO FITTING_SESSION (FTS_ID, FTR_NUM, CUS_ID, FTS_DateTime) VALUES (?, ?, ?, ?)`,
      [sessionId, num, cusId, now]
    );

    res.json({ sessionId, roomNum: num, status: 'occupied' });
  } catch (err) {
    console.error('Fitting session error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการเข้าห้องลองเสื้อ' });
  }
});

// POST /api/fitting-rooms/:num/release (Exit/Release Room)
router.post('/fitting-rooms/:num/release', async (req, res) => {
  const num = String(req.params.num || '1').trim();
  try {
    await run(`UPDATE FITTING_ROOM SET FTR_Status = 'available' WHERE FTR_Num = ?`, [num]);
    // Mark any active orders for this room's completed session as complete
    const lastSession = await get(
      `SELECT FTS_ID FROM FITTING_SESSION WHERE FTR_NUM = ? ORDER BY FTS_DateTime DESC LIMIT 1`,
      [num]
    );
    if (lastSession) {
      await run(
        `UPDATE FITTING_ROOM_ORDER SET FTR_ORD_Status = 'complete' WHERE FTS_ID = ? AND FTR_ORD_Status != 'complete'`,
        [lastSession.FTS_ID]
      );
    }
    res.json({ success: true, roomNum: num, status: 'available' });
  } catch (err) {
    console.error('Release room error:', err);
    res.status(500).json({ error: 'Failed to release fitting room' });
  }
});

// ==========================================================
// 4. FITTING ROOM ORDERS (Kanban & Requests)
// ==========================================================

// GET /api/fitting-orders
router.get('/fitting-orders', async (req, res) => {
  const { roomId, sessionId } = req.query;
  try {
    let sql = `
      SELECT o.FTR_ORD_ID as id,
             LOWER(TRIM(o.FTR_ORD_Status)) as status,
             o.FTR_ORD_DateTime as createdAt,
             s.FTR_NUM as roomId,
             s.CUS_ID as memberId,
             s.FTS_ID as sessionId,
             o.ITV_SKUID as sku,
             COALESCE(v.ITV_Size, '-') as size,
             COALESCE(v.ITV_Color, '-') as color,
             COALESCE(i.ITM_Name, 'เสื้อผ้าสำหรับลอง') as productName,
             COALESCE(i.ITM_Image, '') as image,
             COALESCE(i.ITM_Price, 0) as price,
             e.EMP_FName as staffName
       FROM FITTING_ROOM_ORDER o
       JOIN FITTING_SESSION s ON o.FTS_ID = s.FTS_ID
       LEFT JOIN ITEM_VARIANT v ON o.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       LEFT JOIN EMPLOYEE e ON o.EMP_ID = e.EMP_ID
    `;
    const params = [];

    if (sessionId && roomId) {
      sql += ` WHERE (o.FTS_ID = ? OR s.FTR_NUM = ?) `;
      params.push(sessionId, roomId);
    } else if (sessionId) {
      sql += ` WHERE o.FTS_ID = ? `;
      params.push(sessionId);
    } else if (roomId) {
      sql += ` WHERE s.FTR_NUM = ? AND (
        s.FTS_ID = (SELECT FTS_ID FROM FITTING_SESSION WHERE FTR_NUM = ? ORDER BY FTS_DateTime DESC LIMIT 1)
        OR LOWER(TRIM(o.FTR_ORD_Status)) IN ('pending', 'preparing', 'complete')
      ) `;
      params.push(roomId, roomId);
    }

    // Deterministic sorting: Pending first, Preparing second, Complete last
    // Within each status, newest orders first
    sql += `
      ORDER BY 
        CASE LOWER(TRIM(o.FTR_ORD_Status)) 
          WHEN 'pending' THEN 1 
          WHEN 'preparing' THEN 2 
          WHEN 'complete' THEN 3 
          ELSE 4 
        END ASC,
        o.FTR_ORD_DateTime DESC,
        o.FTR_ORD_ID DESC
    `;

    const orders = await query(sql, params);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching fitting orders:', err);
    res.status(500).json({ error: 'Failed to fetch fitting orders' });
  }
});

// POST /api/fitting-orders
router.post('/fitting-orders', async (req, res) => {
  const { roomId, sessionId: reqSessionId, sku, productName, size, color } = req.body;
  const user = getCurrentUser(req);
  const cusId = user && user.role === 'CUSTOMER' ? user.id : 'u1';

  try {
    const roomNum = String(roomId || '1');
    // Ensure session exists
    let session = null;
    if (reqSessionId) {
      session = await get(`SELECT FTS_ID FROM FITTING_SESSION WHERE FTS_ID = ?`, [reqSessionId]);
    }
    if (!session) {
      session = await get(`SELECT FTS_ID FROM FITTING_SESSION WHERE FTR_NUM = ? ORDER BY FTS_DateTime DESC LIMIT 1`, [roomNum]);
    }
    if (!session) {
      const newSessionId = `fts_${roomNum}_${Date.now()}`;
      await run(`INSERT INTO FITTING_SESSION (FTS_ID, FTR_NUM, CUS_ID, FTS_DateTime) VALUES (?, ?, ?, ?)`,
        [newSessionId, roomNum, cusId, new Date().toISOString()]);
      session = { FTS_ID: newSessionId };
    }

    // Verify SKU exists in ITEM_VARIANT; if not, find best variant for this product
    let targetSku = sku;
    let variant = await get(
      `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_Name 
       FROM ITEM_VARIANT v 
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
       WHERE v.ITV_SKUID = ?`, 
      [targetSku]
    );
    if (!variant) {
      let prodFallback = null;
      if (sku && sku.includes('-')) {
        const prodId = sku.split('-')[0];
        prodFallback = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITM_ID = ? LIMIT 1`, [prodId]);
      }
      if (!prodFallback && productName) {
        prodFallback = await get(`
          SELECT v.ITV_SKUID FROM ITEM_VARIANT v 
          JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
          WHERE i.ITM_Name LIKE ? LIMIT 1
        `, [`%${productName}%`]);
      }
      if (!prodFallback) {
        prodFallback = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT LIMIT 1`);
      }
      targetSku = prodFallback ? prodFallback.ITV_SKUID : 'p1-os-navy';
      variant = await get(
        `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_Name 
         FROM ITEM_VARIANT v 
         JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
         WHERE v.ITV_SKUID = ?`,
        [targetSku]
      );
    }

    // BR-002: สินค้าที่ Stock = 0 ต้องไม่สามารถสั่งได้
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
    const now = new Date().toISOString();

    await run(
      `INSERT INTO FITTING_ROOM_ORDER (FTR_ORD_ID, FTS_ID, ITV_SKUID, EMP_ID, FTR_ORD_Status, FTR_ORD_DateTime)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, session.FTS_ID, targetSku, '68070056', 'pending', now]
    );

    // Retrieve rich details for newly created order
    const created = await get(`
      SELECT o.FTR_ORD_ID as id,
             LOWER(TRIM(o.FTR_ORD_Status)) as status,
             o.FTR_ORD_DateTime as createdAt,
             s.FTR_NUM as roomId,
             s.FTS_ID as sessionId,
             o.ITV_SKUID as sku,
             COALESCE(v.ITV_Size, ?) as size,
             COALESCE(v.ITV_Color, ?) as color,
             COALESCE(i.ITM_Name, ?) as productName,
             COALESCE(i.ITM_Image, '') as image,
             COALESCE(i.ITM_Price, 0) as price
       FROM FITTING_ROOM_ORDER o
       JOIN FITTING_SESSION s ON o.FTS_ID = s.FTS_ID
       LEFT JOIN ITEM_VARIANT v ON o.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE o.FTR_ORD_ID = ?
    `, [size || '-', color || '-', productName || 'เสื้อผ้าสำหรับลอง', orderId]);

    res.json(created || {
      id: orderId,
      roomId: roomNum,
      sessionId: session.FTS_ID,
      sku: targetSku,
      productName: productName || 'เสื้อผ้าสำหรับลอง',
      size: size || '-',
      color: color || '-',
      status: 'pending',
      createdAt: now
    });
  } catch (err) {
    console.error('Create fitting order error:', err);
    res.status(500).json({ error: 'Failed to create fitting order' });
  }
});

// PATCH /api/fitting-orders/:id
router.patch('/fitting-orders/:id', async (req, res) => {
  const { id } = req.params;
  const { status, empId } = req.body; // 'pending', 'preparing', 'complete'
  const user = getCurrentUser(req);
  const staffId = empId || (user && user.role !== 'CUSTOMER' ? user.id : '68070056');

  const cleanStatus = String(status || '').trim().toLowerCase();
  if (!['pending', 'preparing', 'complete'].includes(cleanStatus)) {
    return res.status(400).json({ error: 'สถานะไม่ถูกต้อง (Invalid status)' });
  }

  try {
    if (cleanStatus === 'preparing') {
      await run(
        `UPDATE FITTING_ROOM_ORDER SET FTR_ORD_Status = ?, EMP_ID = ? WHERE FTR_ORD_ID = ?`,
        [cleanStatus, staffId, id]
      );
    } else {
      await run(
        `UPDATE FITTING_ROOM_ORDER SET FTR_ORD_Status = ? WHERE FTR_ORD_ID = ?`,
        [cleanStatus, id]
      );
    }
    res.json({ success: true, id, status: cleanStatus });
  } catch (err) {
    console.error('Update fitting order error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// ==========================================================
// 5. SALE ORDERS & RECEIPTS (SALE_ORDER & SALE_ORDER_LINE)
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
      `SELECT l.*, v.ITV_Color, v.ITV_Size, i.ITM_Name, i.ITM_Image
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
  const now = new Date().toISOString();

  try {
    const result = await withTransaction(async (tx) => {
      let calculatedTotal = 0;
      const verifiedLines = [];

      // 1. Validate all items, check stock, calculate prices strictly from Database
      for (let idx = 0; idx < items.length; idx++) {
        const rawItem = items[idx];
        const sku = String(rawItem.sku || rawItem.id || '').trim();
        const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));

        if (!sku) {
          const err = new Error(`รายการสินค้าลำดับที่ ${idx + 1} ไม่มีรหัส SKU`);
          err.code = 'INVALID_SKU';
          throw err;
        }

        // Fetch authoritative product and variant data from DB
        const variant = await tx.get(
          `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_ID, i.ITM_Name, i.ITM_Price, i.ITM_Image
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

        // BR-002 / BR-003: Check stock before deducting
        if (Number(variant.ITV_Stock) < quantity) {
          const err = new Error(
            `สินค้า '${variant.ITM_Name}' (${variant.ITV_Color || ''} - ${variant.ITV_Size || ''}) มีสต็อกไม่เพียงพอ (คงเหลือ ${variant.ITV_Stock} ชิ้น, ต้องการ ${quantity} ชิ้น)`
          );
          err.code = 'OUT_OF_STOCK';
          err.details = { sku, available: variant.ITV_Stock, requested: quantity, name: variant.ITM_Name };
          throw err;
        }

        // Atomic stock deduction: will only update if current stock >= quantity
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
          image: variant.ITM_Image,
          color: variant.ITV_Color,
          size: variant.ITV_Size,
          price: unitPrice,
          quantity,
          subtotal: lineSubtotal
        });
      }

      // 2. Insert SALE_ORDER with server-calculated total
      await tx.run(
        `INSERT INTO SALE_ORDER (ORD_ID, CUS_ID, EMP_ID, ORD_Method, ORD_Channel, ORD_DateTime, ORD_Total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, cusId, empId, paymentMethod || 'credit', orderChannel, now, calculatedTotal]
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
        await tx.run(`DELETE FROM PAY_CART_LINE WHERE PAY_CART_ID = ?`, ['cart_' + cusId]).catch(() => {});
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
// 6. USERS (MEMBER SEARCH FOR POS)
// ==========================================================

// GET /api/users
router.get('/users', async (req, res) => {
  try {
    const customers = await query(
      `SELECT CUS_ID as id, (CUS_FName || ' ' || CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
       FROM CUSTOMER`
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
