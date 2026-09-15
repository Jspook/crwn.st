// ==========================================================
// crwn.st Database Seeder
// Populates tables from hardcoded data (MySQL)
// ==========================================================

const bcrypt = require('bcryptjs');

async function seedDatabase() {
  const { run, query } = require('./db');

  // 1. Locations
  const locations = [
    { id: 'LOC-01', zone: 'Zone A', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Main Floor' },
    { id: 'LOC-02', zone: 'Zone A', lock: 'Rack 2', shelf: 'Shelf 2', label: 'Knitwear' },
    { id: 'LOC-03', zone: 'Zone B', lock: 'Rack 1', shelf: 'Shelf 1', label: 'Silk & Dresses' },
    { id: 'LOC-04', zone: 'Zone B', lock: 'Rack 2', shelf: 'Shelf 3', label: 'Outerwear' },
  ];

  for (const loc of locations) {
    await run(
      `INSERT IGNORE INTO LOCATION (LOC_ID, LOC_Zone, LOC_Lock, LOC_Shelf, LOC_Label) VALUES (?, ?, ?, ?, ?)`,
      [loc.id, loc.zone, loc.lock, loc.shelf, loc.label]
    );
  }

  // 2. Employees
  const empPass1 = bcrypt.hashSync('68070254', 10);
  const empPass2 = bcrypt.hashSync('68070056', 10);
  await run(
    `INSERT IGNORE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['68070254', 'แคชเชียร์', '(POS)', '0891234567', 'cashier@crwn.st', empPass1, 'CASHIER']
  );
  await run(
    `INSERT IGNORE INTO EMPLOYEE (EMP_ID, EMP_FName, EMP_LName, EMP_Tel, EMP_Email, EMP_Pass, EMP_Role) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ['68070056', 'พนักงาน', 'ห้องลอง', '0891234568', 'fitting@crwn.st', empPass2, 'FITTING_STAFF']
  );

  // 3. Customers
  const cusPass = bcrypt.hashSync('123456', 10);
  await run(
    `INSERT IGNORE INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u1', 'สมชาย', 'ใจดี', 'u1@crwn.st', '0812345678', cusPass]
  );
  await run(
    `INSERT IGNORE INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) VALUES (?, ?, ?, ?, ?, ?)`,
    ['u2', 'สมหญิง', 'ใจงาม', 'u2@crwn.st', '0899999999', cusPass]
  );

  // 4. Products (Items)
  const products = [
    { id: 'p1', name: 'Oversized Cashmere Scarf', desc: 'Curated luxury scarf', price: 2490, category: 'Accessories', tag: 'scarf,cashmere' },
    { id: 'p2', name: 'Chunky Knit Wool Sweater', desc: 'Premium wool sweater', price: 3890, category: 'Tops', tag: 'sweater,wool' },
    { id: 'p3', name: 'Tailored Double-Breasted Coat', desc: 'Luxury tailored coat', price: 8900, category: 'Outerwear', tag: 'coat,tailored' },
    { id: 'p4', name: 'Wide-Leg Pleated Trousers', desc: 'Elegant pleated trousers', price: 3290, category: 'Bottoms', tag: 'trousers,pleated' },
    { id: 'p5', name: 'Silk Crepe Midi Skirt', desc: 'Delicate silk skirt', price: 4190, category: 'Skirts', tag: 'skirt,silk' },
  ];

  for (const p of products) {
    await run(
      `INSERT IGNORE INTO ITEM (ITM_ID, ITM_Name, ITM_Description, ITM_Price, ITM_Category, ITM_Tag) VALUES (?, ?, ?, ?, ?, ?)`,
      [p.id, p.name, p.desc, p.price, p.category, p.tag]
    );
  }

  // 5. Product Variants
  const variants = [
    // p1 - Scarf (OS = One Size)
    { sku: 'p1-os-navy', itemId: 'p1', color: 'Navy', size: 'OS', stock: 10, loc: 'LOC-01' },
    { sku: 'p1-os-camel', itemId: 'p1', color: 'Camel', size: 'OS', stock: 8, loc: 'LOC-01' },
    { sku: 'p1-os-grey', itemId: 'p1', color: 'Grey', size: 'OS', stock: 5, loc: 'LOC-01' },
    // p2 - Sweater
    { sku: 'p2-s-grey', itemId: 'p2', color: 'Grey', size: 'S', stock: 6, loc: 'LOC-02' },
    { sku: 'p2-m-grey', itemId: 'p2', color: 'Grey', size: 'M', stock: 10, loc: 'LOC-02' },
    { sku: 'p2-l-cream', itemId: 'p2', color: 'Cream', size: 'L', stock: 4, loc: 'LOC-02' },
    { sku: 'p2-m-black', itemId: 'p2', color: 'Black', size: 'M', stock: 7, loc: 'LOC-02' },
    // p3 - Coat
    { sku: 'p3-s-black', itemId: 'p3', color: 'Black', size: 'S', stock: 3, loc: 'LOC-04' },
    { sku: 'p3-m-navy', itemId: 'p3', color: 'Navy', size: 'M', stock: 5, loc: 'LOC-04' },
    { sku: 'p3-l-camel', itemId: 'p3', color: 'Camel', size: 'L', stock: 2, loc: 'LOC-04' },
    // p4 - Trousers
    { sku: 'p4-s-black', itemId: 'p4', color: 'Black', size: 'S', stock: 8, loc: 'LOC-03' },
    { sku: 'p4-m-beige', itemId: 'p4', color: 'Beige', size: 'M', stock: 6, loc: 'LOC-03' },
    { sku: 'p4-l-charcoal', itemId: 'p4', color: 'Charcoal', size: 'L', stock: 4, loc: 'LOC-03' },
    // p5 - Skirt
    { sku: 'p5-s-ivory', itemId: 'p5', color: 'Ivory', size: 'S', stock: 5, loc: 'LOC-03' },
    { sku: 'p5-m-champagne', itemId: 'p5', color: 'Champagne', size: 'M', stock: 3, loc: 'LOC-03' },
  ];

  for (const v of variants) {
    await run(
      `INSERT IGNORE INTO ITEM_VARIANT (ITV_SKUID, ITM_ID, ITV_Color, ITV_Size, ITV_Stock, LOC_ID) VALUES (?, ?, ?, ?, ?, ?)`,
      [v.sku, v.itemId, v.color, v.size, v.stock, v.loc]
    );
  }

  console.log('🌱 Seed data inserted successfully.');
}

module.exports = { seedDatabase };
