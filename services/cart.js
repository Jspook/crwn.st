// ==========================================================
// Cart service: PAY_CART & PAY_CART_ITEM (no QTY column, 1 row = 1 piece)
// ==========================================================

const crypto = require('crypto');
const { query, get, run, withTransaction } = require('../database/db');
const { getProductMockImage } = require('../utils/productImages');

function cartIdFor(cusId) {
  return 'cart_' + cusId;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function getCartItems(cusId) {
  const cart = await get(`SELECT PAY_CART_ID FROM PAY_CART WHERE CUS_ID = ?`, [cusId]);
  if (!cart) {
    await run(`INSERT IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartIdFor(cusId), cusId]);
    return [];
  }

  const lines = await query(
    `SELECT l.PAY_ITEM_ID, l.ITV_SKUID, i.ITM_ID as productId, i.ITM_Name, i.ITM_Price, i.ITM_Tag as tag, v.ITV_Color, v.ITV_Size
       FROM PAY_CART_ITEM l
       JOIN ITEM_VARIANT v ON l.ITV_SKUID = v.ITV_SKUID
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE l.PAY_CART_ID = ?`,
    [cart.PAY_CART_ID]
  );

  // Group by SKU to compute quantities
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
  return Object.values(grouped);
}

// Atomic cart replace: validate all SKUs first before clearing
async function replaceCart(cusId, items) {
  if (items && !Array.isArray(items)) {
    throw httpError(400, 'Items must be an array');
  }

  const cartId = cartIdFor(cusId);
  await run(`INSERT IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`, [cartId, cusId]);

  await withTransaction(async (tx) => {
    const validItems = [];

    if (Array.isArray(items)) {
      for (const item of items) {
        const sku = String(item.sku || '').trim();
        if (!sku) continue;
        const v = await tx.get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [sku]);
        if (!v) {
          throw httpError(404, `Invalid SKU: ${sku}`);
        }
        const qty = parseInt(item.quantity, 10);
        if (isNaN(qty) || qty <= 0) {
          throw httpError(400, `Invalid quantity for SKU ${sku}: must be a positive integer`);
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
}

function clearCart(cusId) {
  return run(`DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?`, [cartIdFor(cusId)]);
}

module.exports = { cartIdFor, getCartItems, replaceCart, clearCart };
