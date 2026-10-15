// ==========================================================
// API shape guard for the routes/api/* + services/* restructure
// (spec AC 21, 22, 24). Mock DB only.
// ==========================================================

process.env.USE_MOCK_DB = 'true';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test_secret_32_characters_minimum_length_abcdef';

const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

const { setMockHandler } = require('../database/db');
const { roomOccupancy } = require('../utils/roomOccupancy');
const apiRoutes = require('../routes/api');
const viewRoutes = require('../routes/views');

const SECRET = process.env.COOKIE_SECRET;
const SKU = '8850010110001';

const app = express();
app.use(express.json());
app.use(cookieParser(SECRET));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

function cookieFor(user) {
  return 'crwn_auth=' + encodeURIComponent('s:' + cookieSignature.sign(JSON.stringify(user), SECRET));
}
const CUSTOMER = cookieFor({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
const OTHER = cookieFor({ id: 'cus_002', name: 'Bob', role: 'CUSTOMER' });
const CASHIER = cookieFor({ id: 'cash1', name: 'Cash', role: 'CASHIER' });
const FSTAFF = cookieFor({ id: 'fs1', name: 'Fit', role: 'FITTING_STAFF' });

let server;
function call(method, url, cookie, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = {};
    if (cookie) headers.Cookie = cookie;
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path: url, headers }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => {
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (e) { /* html/text */ }
        resolve({ status: res.statusCode, body: parsed, text, headers: res.headers });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---- mock DB ---------------------------------------------------------
const ITEMS = [
  { ITM_ID: 'p1', ITM_Name: 'Oversized Cotton Tee', ITM_Description: 'Classic tee', ITM_Price: 790, ITM_Category: 'male', ITM_Tag: 'shirt' },
  { ITM_ID: 'p2', ITM_Name: 'Denim Skirt', ITM_Description: 'Skirt', ITM_Price: 1140, ITM_Category: 'female', ITM_Tag: 'skirt' },
  { ITM_ID: 'p3', ITM_Name: 'Plain Tee', ITM_Description: 'Tee', ITM_Price: 500, ITM_Category: 'male', ITM_Tag: 'shirt' }
];
const VARIANTS = [
  { ITV_SKUID: SKU, ITM_ID: 'p1', ITV_Color: 'Black', ITV_Size: 'M', ITV_Stock: 15, LOC_ID: 'LOC-01' },
  { ITV_SKUID: '8850010220002', ITM_ID: 'p1', ITV_Color: 'White', ITV_Size: 'L', ITV_Stock: 8, LOC_ID: 'LOC-01' },
  { ITV_SKUID: '8850520432080', ITM_ID: 'p2', ITV_Color: 'Brown', ITV_Size: '30', ITV_Stock: 21, LOC_ID: 'LOC-03' }
];
let cartLines;
let orders;
let sqlLog;

function variantJoin(sku) {
  const v = VARIANTS.find(x => x.ITV_SKUID === sku);
  if (!v) return null;
  const i = ITEMS.find(x => x.ITM_ID === v.ITM_ID);
  return { ...v, ...i };
}

async function handler(op, sql, params = []) {
  const q = sql.replace(/\s+/g, ' ').trim();
  sqlLog.push({ op, q, params });
  const one = rows => (op === 'get' ? (rows[0] || null) : rows);

  if (q.startsWith('SELECT COUNT(*) as total FROM ITEM')) return { total: ITEMS.length };
  if (q.startsWith('SELECT * FROM ITEM_VARIANT WHERE ITM_ID = ?')) return VARIANTS.filter(v => v.ITM_ID === params[0]);
  if (q.startsWith('SELECT * FROM ITEM_VARIANT')) return VARIANTS;
  if (q.startsWith('SELECT * FROM ITEM WHERE ITM_ID = ?')) return one(ITEMS.filter(i => i.ITM_ID === params[0]));
  if (q.startsWith('SELECT * FROM ITEM')) {
    let list = ITEMS;
    if (q.includes('LIMIT ? OFFSET ?')) {
      const [limit, offset] = params.slice(-2);
      list = ITEMS.slice(offset, offset + limit);
    }
    return list;
  }
  if (q.startsWith('SELECT v.*, i.ITM_Name')) return one([variantJoin(params[0])].filter(Boolean));
  if (q.startsWith('SELECT v.ITV_SKUID, v.ITV_Stock')) return one([variantJoin(params[0])].filter(Boolean));
  if (q.startsWith('SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?')) {
    return one(VARIANTS.filter(v => v.ITV_SKUID === params[0]));
  }

  // cart
  if (q.startsWith('SELECT PAY_CART_ID FROM PAY_CART')) return one([{ PAY_CART_ID: 'cart_' + params[0] }]);
  if (q.startsWith('INSERT IGNORE INTO PAY_CART')) return { changes: 1 };
  if (q.startsWith('DELETE FROM PAY_CART_ITEM')) { cartLines = []; return { changes: 1 }; }
  if (q.startsWith('INSERT INTO PAY_CART_ITEM')) { cartLines.push({ ITV_SKUID: params[2] }); return { changes: 1 }; }
  if (q.includes('FROM PAY_CART_ITEM l')) {
    return cartLines.map((l, i) => {
      const j = variantJoin(l.ITV_SKUID);
      return { PAY_ITEM_ID: 'pi' + i, ITV_SKUID: l.ITV_SKUID, productId: j.ITM_ID, ITM_Name: j.ITM_Name, ITM_Price: j.ITM_Price, tag: j.ITM_Tag, ITV_Color: j.ITV_Color, ITV_Size: j.ITV_Size };
    });
  }

  // receipts
  if (q.startsWith('UPDATE ITEM_VARIANT SET ITV_Stock')) return { changes: 1 };
  if (q.startsWith('INSERT INTO SALE_ORDER_LINE')) return { changes: 1 };
  if (q.startsWith('INSERT INTO SALE_ORDER')) {
    orders.push({ ORD_ID: params[0], CUS_ID: params[1], EMP_ID: params[2], ORD_Method: params[3], ORD_Channel: params[4], ORD_DateTime: params[5], ORD_Total: params[6] });
    return { changes: 1 };
  }
  if (q.startsWith('SELECT * FROM SALE_ORDER WHERE ORD_ID = ?')) return one(orders.filter(o => o.ORD_ID === params[0]).map(o => ({ ...o })));
  if (q.startsWith('SELECT * FROM SALE_ORDER ORDER BY')) return orders;
  if (q.includes('FROM SALE_ORDER_LINE l')) return [{ ORD_LINE_ID: 'l0', ORD_ID: params[0], ITV_SKUID: SKU, ORD_LINE_UPrice: 790, ORD_LINE_Qty: 1, ITV_Color: 'Black', ITV_Size: 'M', ITM_Name: 'Oversized Cotton Tee' }];

  // users
  if (q.includes('FROM CUSTOMER WHERE CUS_Tel = ?')) {
    return params[0] === '0812345678' ? [{ id: 'cus_001', name: 'Alice A', phone: '0812345678', role: 'CUSTOMER' }] : [];
  }

  if (op === 'get') return null;
  if (op === 'run') return { changes: 0 };
  return [];
}

beforeEach(async () => {
  roomOccupancy.clear();
  cartLines = [];
  orders = [];
  sqlLog = [];
  setMockHandler(handler);
  if (!server) server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
});
after(async () => {
  roomOccupancy.clear();
  setMockHandler(null);
  if (server) await new Promise(resolve => server.close(resolve));
});

const sortedKeys = o => Object.keys(o).sort();

describe('AC21 products', () => {
  const PRODUCT_KEYS = ['ITM_Category', 'ITM_ID', 'ITM_Name', 'ITM_Price', 'category', 'description', 'id', 'image', 'name', 'price', 'tag', 'variants'];

  test('GET /api/products (no page) is an array of full product objects with locationId variants', async () => {
    const res = await call('GET', '/api/products');
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body));
    assert.equal(res.body.length, 3);
    for (const p of res.body) assert.deepEqual(sortedKeys(p), PRODUCT_KEYS);
    const p1 = res.body.find(p => p.id === 'p1');
    assert.equal(p1.variants.length, 2);
    assert.deepEqual(sortedKeys(p1.variants[0]), ['color', 'locationId', 'size', 'sku', 'stock']);
    assert.equal(p1.variants[0].locationId, 'LOC-01');
    assert.ok(p1.image);
  });

  test('GET /api/products?page=1&limit=2 is { data, pagination }', async () => {
    const res = await call('GET', '/api/products?page=1&limit=2');
    assert.equal(res.status, 200);
    assert.deepEqual(sortedKeys(res.body), ['data', 'pagination']);
    assert.equal(res.body.data.length, 2);
    assert.deepEqual(res.body.pagination, { page: 1, limit: 2, total: 3, totalPages: 2 });
    assert.deepEqual(sortedKeys(res.body.data[0]), PRODUCT_KEYS);
  });

  test('GET /api/products/barcode/<sku> returns exactly that one variant', async () => {
    const res = await call('GET', `/api/products/barcode/${SKU}`);
    assert.equal(res.status, 200);
    assert.deepEqual(sortedKeys(res.body), ['category', 'id', 'image', 'name', 'price', 'tag', 'variants']);
    assert.equal(res.body.id, 'p1');
    assert.equal(res.body.variants.length, 1);
    assert.deepEqual(res.body.variants[0], { sku: SKU, color: 'Black', size: 'M', stock: 15 });
  });

  test('GET /api/products/barcode/<ITM_ID> returns all variants of the item', async () => {
    const res = await call('GET', '/api/products/barcode/p1');
    assert.equal(res.status, 200);
    assert.equal(res.body.variants.length, 2);
  });

  test('GET /api/products/barcode/<unknown> is 404 with { error }', async () => {
    const res = await call('GET', '/api/products/barcode/0000000000000');
    assert.equal(res.status, 404);
    assert.equal(typeof res.body.error, 'string');
  });
});

describe('AC21 cart', () => {
  test('non-customer / anonymous: GET {items:[]}, POST and DELETE succeed without storing', async () => {
    assert.deepEqual((await call('GET', '/api/cart')).body, { items: [] });
    assert.equal((await call('POST', '/api/cart', undefined, { items: [] })).body.success, true);
    assert.deepEqual((await call('DELETE', '/api/cart')).body, { success: true });
    assert.equal(sqlLog.length, 0);
  });

  test('customer POST then GET returns grouped items with quantity, then DELETE clears', async () => {
    const post = await call('POST', '/api/cart', CUSTOMER, { items: [{ sku: SKU, quantity: 2 }] });
    assert.equal(post.status, 200);
    assert.deepEqual(post.body, { success: true });
    const got = await call('GET', '/api/cart', CUSTOMER);
    assert.equal(got.status, 200);
    assert.equal(got.body.items.length, 1);
    assert.deepEqual(sortedKeys(got.body.items[0]), ['color', 'image', 'name', 'price', 'productId', 'quantity', 'size', 'sku', 'tag']);
    assert.equal(got.body.items[0].quantity, 2);
    const del = await call('DELETE', '/api/cart', CUSTOMER);
    assert.deepEqual(del.body, { success: true });
    assert.deepEqual((await call('GET', '/api/cart', CUSTOMER)).body, { items: [] });
  });

  test('customer POST: non-array items is 400, bad quantity 400, unknown SKU 404', async () => {
    assert.equal((await call('POST', '/api/cart', CUSTOMER, { items: 'x' })).status, 400);
    assert.equal((await call('POST', '/api/cart', CUSTOMER, { items: [{ sku: SKU, quantity: 0 }] })).status, 400);
    assert.equal((await call('POST', '/api/cart', CUSTOMER, { items: [{ sku: '1111111111111', quantity: 1 }] })).status, 404);
  });
});

describe('AC21 fitting rooms', () => {
  test('GET /api/fitting-rooms lists 10 rooms with 8 keys each', async () => {
    const res = await call('GET', '/api/fitting-rooms');
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 10);
    for (const r of res.body) {
      assert.deepEqual(sortedKeys(r), ['FTR_Num', 'FTR_Status', 'canResume', 'isMyRoom', 'isOccupied', 'occupantName', 'roomDisplay', 'roomNumber']);
    }
    assert.ok(res.body.every(r => r.isOccupied === false && r.FTR_Status === 'available'));
  });

  test('POST /enter returns the 6-key shape; second customer gets 409; anonymous 403; bad room 400', async () => {
    const res = await call('POST', '/api/fitting-rooms/1/enter', CUSTOMER, {});
    assert.equal(res.status, 200);
    assert.deepEqual(sortedKeys(res.body), ['customerPresent', 'resumed', 'roomDisplay', 'roomId', 'sessionId', 'success']);
    assert.equal(res.body.success, true);
    assert.equal(res.body.customerPresent, true);
    assert.equal(res.body.resumed, false);
    assert.equal(res.body.roomId, '5684848452325');
    assert.equal(res.body.roomDisplay, '1');
    assert.equal((await call('POST', '/api/fitting-rooms/1/enter', OTHER, {})).status, 409);
    assert.equal((await call('POST', '/api/fitting-rooms/2/enter', undefined, {})).status, 403);
    assert.equal((await call('POST', '/api/fitting-rooms/99/enter', CUSTOMER, {})).status, 400);
    assert.equal(sqlLog.length, 0, 'enter runs no SQL');
  });

  test('GET /api/fitting-rooms marks my room and an occupied room for others', async () => {
    await call('POST', '/api/fitting-rooms/1/enter', CUSTOMER, {});
    const mine = (await call('GET', '/api/fitting-rooms', CUSTOMER)).body.find(r => r.roomNumber === '1');
    assert.equal(mine.isMyRoom, true);
    assert.equal(mine.canResume, true);
    const theirs = (await call('GET', '/api/fitting-rooms', OTHER)).body.find(r => r.roomNumber === '1');
    assert.equal(theirs.isMyRoom, false);
    assert.equal(theirs.isOccupied, true);
    assert.equal(theirs.FTR_Status, 'occupied');
  });

  test('GET /api/fitting-orders guards: anonymous 401, cashier 403, customer without roomId 400', async () => {
    assert.equal((await call('GET', '/api/fitting-orders')).status, 401);
    assert.equal((await call('GET', '/api/fitting-orders', CASHIER)).status, 403);
    assert.equal((await call('GET', '/api/fitting-orders', CUSTOMER)).status, 400);
  });

  test('POST /fitting-orders response keys and PATCH /fitting-orders body keys', async () => {
    const e = await call('POST', '/api/fitting-rooms/1/enter', CUSTOMER, {});
    assert.equal(e.status, 200);
    setMockHandler(async (op, sql, params) => {
      const q = sql.replace(/\s+/g, ' ').trim();
      if (q.startsWith('INSERT INTO FITTING_ROOM')) { orders.push({ id: params[0], t: params[4], room: params[2], cus: params[3] }); return { changes: 1 }; }
      if (q.startsWith('SELECT FTR_OrderID')) {
        const o = orders[0];
        return { FTR_OrderID: o.id, CUS_ID: o.cus, FTR_Number: o.room, FTR_OrderTime: o.t, EMP_ID: null, FTR_FinishTime: null };
      }
      if (q.startsWith('UPDATE FITTING_ROOM')) return { changes: 1 };
      return handler(op, sql, params);
    });
    const created = await call('POST', '/api/fitting-orders', CUSTOMER, { roomId: '1', sku: SKU });
    assert.equal(created.status, 200);
    assert.deepEqual(sortedKeys(created.body), ['color', 'createdAt', 'id', 'price', 'productName', 'roomDisplay', 'roomId', 'size', 'sku', 'status']);
    const patched = await call('PATCH', `/api/fitting-orders/${created.body.id}`, FSTAFF, { status: 'preparing' });
    assert.equal(patched.status, 200);
    assert.deepEqual(sortedKeys(patched.body), ['finishedAt', 'id', 'status', 'success']);
    // role guards
    assert.equal((await call('PATCH', `/api/fitting-orders/${created.body.id}`, CUSTOMER, { status: 'preparing' })).status, 403);
    assert.equal((await call('POST', '/api/fitting-orders', FSTAFF, { roomId: '1', sku: SKU })).status, 403);
  });
});

describe('AC21 receipts and users', () => {
  const sale = cookie => call('POST', '/api/receipts', cookie, { paymentMethod: 'cash', items: [{ sku: SKU, quantity: 1 }] });

  test('POST /api/receipts returns the documented shape with an rcpt_ id', async () => {
    const res = await sale(CUSTOMER);
    assert.equal(res.status, 200);
    assert.deepEqual(sortedKeys(res.body), ['ORD_ID', 'createdAt', 'id', 'items', 'paymentMethod', 'subtotal', 'success', 'total']);
    assert.equal(res.body.success, true);
    assert.ok(res.body.id.startsWith('rcpt_'));
    assert.equal(res.body.id, res.body.ORD_ID);
    assert.equal(res.body.total, 790);
    assert.equal(res.body.paymentMethod, 'cash');
    assert.equal(res.body.items.length, 1);
  });

  test('two receipts created back to back get distinct ids', async () => {
    const ids = new Set();
    const results = await Promise.all(Array.from({ length: 8 }, () => sale(CUSTOMER)));
    for (const r of results) { assert.equal(r.status, 200); ids.add(r.body.id); }
    assert.equal(ids.size, 8);
  });

  test('POST /api/receipts validation: bad method, empty cart, unknown SKU, anonymous', async () => {
    const badMethod = await call('POST', '/api/receipts', CUSTOMER, { paymentMethod: 'bitcoin', items: [{ sku: SKU }] });
    assert.equal(badMethod.status, 400);
    assert.equal(badMethod.body.error.code, 'INVALID_METHOD');
    const empty = await call('POST', '/api/receipts', CUSTOMER, { items: [] });
    assert.equal(empty.status, 400);
    assert.equal(empty.body.error.code, 'INVALID_CART');
    const unknown = await call('POST', '/api/receipts', CUSTOMER, { items: [{ sku: '1111111111111', quantity: 1 }] });
    assert.equal(unknown.status, 400);
    assert.equal(unknown.body.error.code, 'PRODUCT_NOT_FOUND');
    assert.equal((await call('POST', '/api/receipts', undefined, { items: [{ sku: SKU }] })).status, 401);
  });

  test('GET /api/receipts/:id: owner 200 with items, other customer 404, cashier 200', async () => {
    const made = await sale(CUSTOMER);
    const owner = await call('GET', `/api/receipts/${made.body.id}`, CUSTOMER);
    assert.equal(owner.status, 200);
    assert.equal(owner.body.ORD_ID, made.body.id);
    assert.ok(Array.isArray(owner.body.items));
    assert.equal((await call('GET', `/api/receipts/${made.body.id}`, OTHER)).status, 404);
    assert.equal((await call('GET', `/api/receipts/${made.body.id}`, CASHIER)).status, 200);
    assert.equal((await call('GET', '/api/receipts/does_not_exist', CUSTOMER)).status, 404);
  });

  test('GET /api/receipts is cashier only', async () => {
    await sale(CUSTOMER);
    const ok = await call('GET', '/api/receipts', CASHIER);
    assert.equal(ok.status, 200);
    assert.ok(Array.isArray(ok.body));
    assert.equal((await call('GET', '/api/receipts', CUSTOMER)).status, 403);
  });

  test('GET /api/users?phone=: cashier gets an array, customer 403, invalid phone []', async () => {
    const hit = await call('GET', '/api/users?phone=0812345678', CASHIER);
    assert.equal(hit.status, 200);
    assert.deepEqual(hit.body, [{ id: 'cus_001', name: 'Alice A', phone: '0812345678', role: 'CUSTOMER' }]);
    assert.equal((await call('GET', '/api/users?phone=0812345678', CUSTOMER)).status, 403);
    assert.deepEqual((await call('GET', '/api/users?phone=12', CASHIER)).body, []);
  });
});

describe('AC22 routes/api aggregator', () => {
  test('is an Express router exposing every inventory path and method', () => {
    assert.equal(typeof apiRoutes, 'function');
    assert.ok(Array.isArray(apiRoutes.stack));
    const found = new Set();
    const walk = stack => {
      for (const layer of stack) {
        if (layer.route) {
          for (const m of Object.keys(layer.route.methods)) found.add(`${m.toUpperCase()} ${layer.route.path}`);
        } else if (layer.handle && layer.handle.stack) {
          walk(layer.handle.stack);
        }
      }
    };
    walk(apiRoutes.stack);
    const expected = [
      'GET /products', 'GET /products/barcode/:code',
      'GET /cart', 'POST /cart', 'DELETE /cart',
      'GET /fitting-orders', 'POST /fitting-orders', 'PATCH /fitting-orders/:id',
      'GET /fitting-rooms', 'POST /fitting-rooms/:roomId/enter', 'POST /fitting-rooms/:roomId/release',
      'GET /receipts', 'GET /receipts/:id', 'POST /receipts',
      'GET /users'
    ];
    for (const e of expected) assert.ok(found.has(e), `missing route ${e}`);
  });

  test('every inventory path answers over HTTP (never the Express default 404)', async () => {
    const calls = [
      ['GET', '/api/products'], ['GET', '/api/products/barcode/x'],
      ['GET', '/api/cart'], ['POST', '/api/cart'], ['DELETE', '/api/cart'],
      ['GET', '/api/fitting-orders'], ['POST', '/api/fitting-orders'], ['PATCH', '/api/fitting-orders/x'],
      ['GET', '/api/fitting-rooms'], ['POST', '/api/fitting-rooms/1/enter'], ['POST', '/api/fitting-rooms/1/release'],
      ['GET', '/api/receipts'], ['GET', '/api/receipts/x'], ['POST', '/api/receipts'],
      ['GET', '/api/users']
    ];
    for (const [method, url] of calls) {
      const res = await call(method, url, undefined, method === 'GET' || method === 'DELETE' ? undefined : {});
      assert.ok(!/Cannot (GET|POST|PATCH|DELETE)/.test(res.text), `${method} ${url} is not mounted`);
    }
  });
});

describe('AC24 GET /customer/fitting-room without roomId', () => {
  test('redirects to the dashboard and does not acquire any room', async () => {
    const res = await call('GET', '/customer/fitting-room', CUSTOMER);
    assert.equal(res.status, 302);
    assert.equal(res.headers.location, '/customer/dashboard');
    assert.deepEqual(roomOccupancy.list(), []);
  });
});
