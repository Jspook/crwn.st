// ==========================================================
// crwn.st REST Web Services & API Endpoints
// MySQL — 10-table schema
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
      `SELECT v.*, i.ITM_Name, i.ITM_Price, i.ITM_Category, i.ITM_Description
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
      const barcodeMap = {
        '8901234567891': 'p1',
        '8901234567892': 'p2',
        '8901234567893': 'p3',
        '8901234567894': 'p4',
        '8901234567895': 'p5',
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
          const firstV = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT LIMIT 1`);
          sku = firstV ? firstV.ITV_SKUID : 'p1-os-navy';
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

// GET /api/fitting-orders
router.get('/fitting-orders', async (req, res) => {
  const { roomId } = req.query;
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
             COALESCE(v.ITV_Size, '-') as size,
             COALESCE(v.ITV_Color, '-') as color,
             COALESCE(i.ITM_Name, 'เสื้อผ้าสำหรับลอง') as productName,
             COALESCE(i.ITM_Price, 0) as price,
             e.EMP_FName as staffName
       FROM FITTING_ROOM f
       LEFT JOIN ITEM_VARIANT v ON f.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       LEFT JOIN EMPLOYEE e ON f.EMP_ID = e.EMP_ID
    `;
    const params = [];

    if (roomId) {
      sql += ` WHERE f.FTR_Number = ? `;
      params.push(roomId);
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

    const orders = await query(sql, params);
    res.json(orders);
  } catch (err) {
    console.error('Error fetching fitting orders:', err);
    res.status(500).json({ error: 'Failed to fetch fitting orders' });
  }
});

// POST /api/fitting-orders
router.post('/fitting-orders', async (req, res) => {
  const { roomId, sku, productName, size, color } = req.body;

  try {
    const roomNum = String(roomId || '1');

    // Verify SKU exists in ITEM_VARIANT
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

      // 2. Insert SALE_ORDER with server-calculated total
      const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
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
