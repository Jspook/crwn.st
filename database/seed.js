// ==========================================================
// crwn.st Database Seeder
// Populates all 14 ER diagram tables from source data
// ==========================================================

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function seedDatabase() {
  const { run, query } = require('./db');

  // 1. Locations
  const locations = [
    { id: 'LOC-01', zone: 'Zone A', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Main Floor - Accessories' },
    { id: 'LOC-02', zone: 'Zone A', lock: 'Rack 2', shelf: 'Shelf 2', label: 'Main Floor - Knitwear' },
    { id: 'LOC-03', zone: 'Zone B', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Back Room - Silk & Dresses' },
    { id: 'LOC-04', zone: 'Zone B', lock: 'Rack 2', shelf: 'Shelf 3', label: 'Back Room - Outerwear' },
  ];

  for (const loc of locations) {
    await run(
      `INSERT OR IGNORE INTO LOCATION (LOC_ID, LOC_Zone, LOC_Lock, LOC_Shelf, LOC_Label) VALUES (?, ?, ?, ?, ?)`,
      [loc.id, loc.zone, loc.lock, loc.shelf, loc.label]
    );
  }

  // 2. Employees & Customers from users.json
  const usersPath = path.join(__dirname, '..', 'data', 'users.json');
  if (fs.existsSync(usersPath)) {
    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    for (const u of users) {
      if (u.role === 'CUSTOMER') {
        const parts = (u.name || 'Customer').split(' ');
        const fName = parts[0] || 'Customer';
        const lName = parts.slice(1).join(' ') || 'User';
        const hashedPass = bcrypt.hashSync('123456', 10);
        await run(
          `INSERT OR IGNORE INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) VALUES (?, ?, ?, ?, ?, ?)`,
          [u.id, fName, lName, `${u.id}@crwn.st`, u.phone || '0812345678', hashedPass]
        );
      } else {
        const parts = (u.name || 'Employee').split(' ');
        const fName = parts[0] || 'Staff';
        const lName = parts.slice(1).join(' ') || 'Member';
        const hashedPass = bcrypt.hashSync(u.password || 'password', 10);
        await run(
          `INSERT OR IGNORE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [u.id, fName, lName, '0891234567', `${u.username || u.id}@crwn.st`, hashedPass, u.role]
        );
      }
    }
  }

  // 3. Fitting Rooms
  const rooms = [
    { num: '1', status: 'available' },
    { num: '2', status: 'occupied' },
    { num: '3', status: 'available' },
  ];
  for (const r of rooms) {
    await run(
      `INSERT OR IGNORE INTO FITTING_ROOM (FTR_Num, FTR_Status) VALUES (?, ?)`,
      [r.num, r.status]
    );
  }

  // 4. Products & Variants from products.json
  const productsPath = path.join(__dirname, '..', 'data', 'products.json');
  if (fs.existsSync(productsPath)) {
    const products = JSON.parse(fs.readFileSync(productsPath, 'utf-8'));
    for (const p of products) {
      const tags = Array.isArray(p.tags) ? p.tags.join(', ') : '';
      await run(
        `INSERT OR IGNORE INTO ITEM (ITM_ID, ITM_Name, ITM_Description, ITM_Price, ITM_Category, ITM_Tag, ITM_Image) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          p.id,
          p.name,
          `${p.name} - Curated luxury atelier piece from crwn.st`,
          p.price,
          p.category || 'General',
          tags,
          p.image || `https://picsum.photos/seed/${p.id}/800/800`,
        ]
      );

      if (Array.isArray(p.variants)) {
        for (let i = 0; i < p.variants.length; i++) {
          const v = p.variants[i];
          const locId = locations[i % locations.length].id;
          await run(
            `INSERT OR IGNORE INTO ITEM_VARIANT (ITV_SKUID, ITM_ID, ITV_Color, ITV_Size, ITV_Stock, LOC_ID) VALUES (?, ?, ?, ?, ?, ?)`,
            [v.sku, p.id, v.color, v.size, v.stock ?? 10, locId]
          );
        }
      }
    }
  }

  // 5. Fitting Session & Fitting Room Orders
  const now = new Date().toISOString();
  await run(
    `INSERT OR IGNORE INTO FITTING_SESSION (FTS_ID, FTR_NUM, CUS_ID, FTS_DateTime) VALUES (?, ?, ?, ?)`,
    ['fts_demo_01', '2', 'u2', now]
  );

  // Pay Cart for customer u1
  await run(
    `INSERT OR IGNORE INTO PAY_CART (PAY_CART_ID, CUS_ID) VALUES (?, ?)`,
    ['cart_u1', 'u1']
  );

  // Fit Cart for session
  await run(
    `INSERT OR IGNORE INTO FIT_CART (FIT_CART_ID, FTS_ID, PAY_CART_ID) VALUES (?, ?, ?)`,
    ['fitcart_01', 'fts_demo_01', 'cart_u1']
  );

  // Fitting room orders from fittingOrders.json
  const fittingOrdersPath = path.join(__dirname, '..', 'data', 'fittingOrders.json');
  if (fs.existsSync(fittingOrdersPath)) {
    const orders = JSON.parse(fs.readFileSync(fittingOrdersPath, 'utf-8'));
    const allVariants = await query('SELECT ITV_SKUID FROM ITEM_VARIANT');
    const validSkus = new Set(allVariants.map(v => v.ITV_SKUID));

    for (const o of orders) {
      let targetSku = o.sku;
      if (!validSkus.has(targetSku)) {
        // Fallback to first available SKU
        targetSku = allVariants[0]?.ITV_SKUID || 'p1-os-navy';
      }
      const ftsId = 'fts_demo_01';
      await run(
        `INSERT OR IGNORE INTO FITTING_ROOM_ORDER (FTR_ORD_ID, FTS_ID, ITV_SKUID, EMP_ID, FTR_ORD_Status, FTR_ORD_DateTime) VALUES (?, ?, ?, ?, ?, ?)`,
        [o.id, ftsId, targetSku, 'f1', o.status || 'pending', o.createdAt || now]
      );
    }
  }

  // 6. Sale Orders & Lines from receipts.json
  const receiptsPath = path.join(__dirname, '..', 'data', 'receipts.json');
  if (fs.existsSync(receiptsPath)) {
    const receipts = JSON.parse(fs.readFileSync(receiptsPath, 'utf-8'));
    const allVariants = await query('SELECT ITV_SKUID FROM ITEM_VARIANT');
    const validSkus = new Set(allVariants.map(v => v.ITV_SKUID));

    for (const r of receipts) {
      await run(
        `INSERT OR IGNORE INTO SALE_ORDER (ORD_ID, CUS_ID, EMP_ID, ORD_Method, ORD_Channel, ORD_DateTime, ORD_Total) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.memberId || 'u1',
          'c1',
          r.paymentMethod || 'credit',
          r.memberId ? 'customer_pay_and_go' : 'pos_cashier',
          r.createdAt || now,
          r.total || 0,
        ]
      );

      if (Array.isArray(r.items)) {
        for (let idx = 0; idx < r.items.length; idx++) {
          const item = r.items[idx];
          let sku = item.sku;
          if (!validSkus.has(sku)) {
            sku = allVariants[0]?.ITV_SKUID || 'p1-os-navy';
          }
          await run(
            `INSERT OR IGNORE INTO SALE_ORDER_LINE (ORD_LINE_ID, ORD_ID, ITV_SKUID, ORD_LINE_UPrice, ORD_LINE_Qty) VALUES (?, ?, ?, ?, ?)`,
            [`line_${r.id}_${idx}`, r.id, sku, item.price || 0, item.quantity || 1]
          );
        }
      }
    }
  }
}

module.exports = { seedDatabase };
