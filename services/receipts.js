// ==========================================================
// Receipts service: SALE_ORDER & SALE_ORDER_LINE
// ==========================================================

const { query, get, withTransaction } = require('../database/db');
const { newShortId } = require('../utils/ids');

function listReceipts() {
  return query(`SELECT * FROM SALE_ORDER ORDER BY ORD_DateTime DESC`);
}

async function getReceiptWithLines(id) {
  const order = await get(`SELECT * FROM SALE_ORDER WHERE ORD_ID = ?`, [id]);
  if (!order) return null;

  const lines = await query(
    `SELECT l.*, v.ITV_Color, v.ITV_Size, i.ITM_Name
       FROM SALE_ORDER_LINE l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.ORD_ID = ?`,
    [id]
  );
  order.items = lines;
  return order;
}

function canViewReceipt(order, user) {
  return !!order && (user.role === 'CASHIER' || (user.role === 'CUSTOMER' && order.CUS_ID === user.id));
}

// Throws errors with .code (INVALID_SKU / PRODUCT_NOT_FOUND / OUT_OF_STOCK) for known failures.
async function createSale({ items, paymentMethod, cusId, empId, channel }) {
  const orderId = newShortId('rcpt_');

  return withTransaction(async (tx) => {
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
      [orderId, cusId, empId, paymentMethod || 'credit', channel, now, totalWithVat]
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
}

module.exports = { listReceipts, getReceiptWithLines, canViewReceipt, createSale };
