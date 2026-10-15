// ==========================================================
// Comprehensive Audit Remediation Regression Test Suite
// Verifies all audit fixes with 100% Mock DB Isolation
// Zero live database mutations guaranteed
// ==========================================================

process.env.USE_MOCK_DB = 'true';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test_secret_32_characters_minimum_length_abcdef';

const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');
const fs = require('node:fs');
const path = require('node:path');

const { setMockHandler } = require('../database/db');
const roomResolver = require('../utils/roomResolver');
const apiRoutes = require('../routes/api');
const { roomOccupancy } = require('../utils/roomOccupancy');

const TEST_SECRET = process.env.COOKIE_SECRET;

function makeSignedAuthCookie(user, secret = TEST_SECRET) {
  const val = JSON.stringify(user);
  const signed = 's:' + cookieSignature.sign(val, secret);
  return `crwn_auth=${encodeURIComponent(signed)}`;
}

function makeRequest(app, options, body = null, cookies = null) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = server.address().port;
      const reqOptions = {
        hostname: '127.0.0.1',
        port: port,
        path: options.path,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {})
        }
      };

      if (cookies) {
        reqOptions.headers['Cookie'] = cookies;
      }

      const req = http.request(reqOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          server.close(() => {
            let parsed = null;
            try {
              parsed = JSON.parse(data);
            } catch (e) {
              parsed = data;
            }
            resolve({
              status: res.statusCode,
              headers: res.headers,
              body: parsed
            });
          });
        });
      });

      req.on('error', (err) => {
        server.close();
        reject(err);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

// In-memory mock data store
let mockFittingRoomRows = [];
let mockCartItemRows = [];

const mockCatalog = [
  {
    id: 'p1',
    name: 'Oversized Cotton Tee',
    desc: 'Classic tee',
    price: 790,
    category: 'male',
    tag: 'shirt',
    image: 'https://images.unsplash.com/shirt.jpg',
    variants: [
      { sku: '8850010110001', color: 'Black', size: 'M', stock: 15, location: 'LOC-01' },
      { sku: '8850010220002', color: 'White', size: 'L', stock: 8, location: 'LOC-01' }
    ]
  },
  {
    id: 'p52',
    name: 'A-Line Denim Mini Skirt',
    desc: 'Vintage skirt',
    price: 1140,
    category: 'female',
    tag: 'skirt',
    image: 'https://images.unsplash.com/skirt.jpg',
    variants: [
      { sku: '8850520432080', color: 'Brown', size: '30', stock: 21, location: 'LOC-03' }
    ]
  }
];

function resetMockDb() {
  mockFittingRoomRows = [];
  mockCartItemRows = [];
  roomOccupancy.clear();
}

function handleMockQuery(type, sql, params = []) {
  const norm = sql.trim().replace(/\s+/g, ' ');

  // 1. FITTING_ROOM queries (schema.sql columns only; occupancy lives in memory)

  // Insert fitting order: [orderId, sku, roomNumber, cusId, orderTime]
  if (norm.startsWith('INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, CUS_ID, FTR_OrderTime) VALUES (?, ?, NULL, ?, ?, ?)')) {
    const [orderId, sku, roomNum, cusId, orderTime] = params;
    mockFittingRoomRows.push({
      FTR_OrderID: orderId,
      ITV_SKUID: sku,
      EMP_ID: null,
      FTR_Number: String(roomNum),
      FTR_OrderTime: orderTime,
      FTR_FinishTime: null,
      CUS_ID: String(cusId)
    });
    return { insertId: 1, changes: 1 };
  }

  // Staff PATCH: locked row read
  if (norm.startsWith('SELECT FTR_OrderID, CUS_ID, FTR_Number, FTR_OrderTime, EMP_ID, FTR_FinishTime FROM FITTING_ROOM WHERE FTR_OrderID = ?')) {
    const r = mockFittingRoomRows.find(x => x.FTR_OrderID === String(params[0]));
    return r ? { ...r } : null;
  }
  // Claim: [empId, orderId]
  if (norm === 'UPDATE FITTING_ROOM SET EMP_ID = ? WHERE FTR_OrderID = ? AND EMP_ID IS NULL AND FTR_FinishTime IS NULL') {
    const [empId, orderId] = params;
    const r = mockFittingRoomRows.find(x => x.FTR_OrderID === String(orderId));
    if (!r || r.EMP_ID != null || r.FTR_FinishTime) return { changes: 0 };
    r.EMP_ID = empId;
    return { changes: 1 };
  }
  // Complete: [finishTime, orderId, empId]
  if (norm === 'UPDATE FITTING_ROOM SET FTR_FinishTime = ? WHERE FTR_OrderID = ? AND EMP_ID = ? AND FTR_FinishTime IS NULL') {
    const [finishTime, orderId, empId] = params;
    const r = mockFittingRoomRows.find(x => x.FTR_OrderID === String(orderId));
    if (!r || String(r.EMP_ID) !== String(empId) || r.FTR_FinishTime) return { changes: 0 };
    r.FTR_FinishTime = finishTime;
    return { changes: 1 };
  }

  // Orders list query (coarse SQL filter; the service applies the visit filter in JS)
  if (norm.includes('FROM FITTING_ROOM f') && norm.includes('LEFT JOIN ITEM_VARIANT v')) {
    return mockFittingRoomRows.filter(r => r.ITV_SKUID).map(o => {
      let catalogItem = null;
      let variant = null;
      for (const itm of mockCatalog) {
        const v = itm.variants.find(va => va.sku === o.ITV_SKUID);
        if (v) {
          catalogItem = itm;
          variant = v;
          break;
        }
      }
      return {
        id: o.FTR_OrderID,
        status: o.FTR_FinishTime ? 'complete' : (o.EMP_ID ? 'preparing' : 'pending'),
        createdAt: o.FTR_OrderTime,
        finishedAt: o.FTR_FinishTime,
        roomId: o.FTR_Number,
        sku: o.ITV_SKUID,
        empId: o.EMP_ID,
        size: variant ? variant.size : '-',
        color: variant ? variant.color : '-',
        productName: catalogItem ? catalogItem.name : 'Unknown',
        price: catalogItem ? catalogItem.price : 0,
        tag: catalogItem ? catalogItem.tag : 'general',
        productId: catalogItem ? catalogItem.id : 'p1',
        staffName: o.EMP_ID ? 'Staff Member' : null,
        cusId: o.CUS_ID
      };
    });
  }

  // 2. ITEM_VARIANT & ITEM Queries
  // Existence check in POST /cart
  if (norm.includes('SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_SKUID = ?')) {
    const sku = params[0];
    for (const itm of mockCatalog) {
      const v = itm.variants.find(va => va.sku === sku);
      if (v) return type === 'get' ? { ITV_SKUID: v.sku } : [{ ITV_SKUID: v.sku }];
    }
    return type === 'get' ? null : [];
  }

  // Strict lookup in POST /fitting-orders: SELECT v.ITV_SKUID, ... FROM ITEM_VARIANT v JOIN ITEM i
  if (norm.includes('FROM ITEM_VARIANT v') && norm.includes('JOIN ITEM i ON v.ITM_ID = i.ITM_ID') && norm.includes('WHERE v.ITV_SKUID = ?')) {
    const sku = params[0];
    for (const itm of mockCatalog) {
      const v = itm.variants.find(va => va.sku === sku);
      if (v) {
        const row = {
          ITV_SKUID: v.sku,
          ITV_Stock: v.stock,
          ITV_Color: v.color,
          ITV_Size: v.size,
          ITM_Name: itm.name,
          ITM_Price: itm.price,
          ITM_Tag: itm.tag,
          ITM_ID: itm.id
        };
        return type === 'get' ? row : [row];
      }
    }
    return type === 'get' ? null : [];
  }

  // 3. CART Queries
  if (norm.includes('SELECT PAY_CART_ID FROM PAY_CART WHERE CUS_ID = ?')) {
    const cusId = params[0];
    return type === 'get' ? { PAY_CART_ID: 'cart_' + cusId } : [{ PAY_CART_ID: 'cart_' + cusId }];
  }

  if (norm.includes('INSERT IGNORE INTO PAY_CART')) {
    return { changes: 1 };
  }

  if (norm.includes('DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?')) {
    const cartId = params[0];
    mockCartItemRows = mockCartItemRows.filter(r => r.PAY_CART_ID !== cartId);
    return { changes: 1 };
  }

  if (norm.includes('INSERT INTO PAY_CART_ITEM (PAY_ITEM_ID, PAY_CART_ID, ITV_SKUID)')) {
    const [lineId, cartId, sku] = params;
    mockCartItemRows.push({ PAY_ITEM_ID: lineId, PAY_CART_ID: cartId, ITV_SKUID: sku });
    return { changes: 1 };
  }

  if (norm.includes('FROM PAY_CART_ITEM') && norm.includes('WHERE l.PAY_CART_ID = ?')) {
    const cartId = params[0];
    const items = mockCartItemRows.filter(r => r.PAY_CART_ID === cartId);
    return items.map(ci => {
      let catalogItem = null;
      let variant = null;
      for (const itm of mockCatalog) {
        const v = itm.variants.find(va => va.sku === ci.ITV_SKUID);
        if (v) {
          catalogItem = itm;
          variant = v;
          break;
        }
      }
      return {
        PAY_ITEM_ID: ci.PAY_ITEM_ID,
        ITV_SKUID: ci.ITV_SKUID,
        VAR_Color: variant ? variant.color : '-',
        VAR_Size: variant ? variant.size : '-',
        productId: catalogItem ? catalogItem.id : 'p1',
        ITM_Name: catalogItem ? catalogItem.name : 'Unknown',
        ITM_Price: catalogItem ? catalogItem.price : 0,
        tag: catalogItem ? catalogItem.tag : 'general'
      };
    });
  }

  if (type === 'get') return null;
  if (type === 'run') return { changes: 0 };
  return [];
}

setMockHandler(handleMockQuery);

// Express test app
const app = express();
app.use(express.json());
app.use(cookieParser(TEST_SECRET));
app.use('/api', apiRoutes);

describe('Audit Remediation Regression Test Suite', () => {
  before(() => {
    resetMockDb();
  });

  describe('T07 / BUG-007: Canonical Room Resolver & Unknown QR Rejection', () => {
    test('resolves canonical 13-digit room barcodes (Rooms 1-4)', () => {
      const r1 = roomResolver.resolveRoom('5684848452325');
      assert.ok(r1);
      assert.strictEqual(r1.roomNumber, '1');
      assert.strictEqual(r1.barcode, '5684848452325');

      const r4 = roomResolver.resolveRoom('5684848452328');
      assert.ok(r4);
      assert.strictEqual(r4.roomNumber, '4');
    });

    test('resolves short room number aliases (1..4)', () => {
      const r2 = roomResolver.resolveRoom('2');
      assert.ok(r2);
      assert.strictEqual(r2.roomNumber, '2');
      assert.strictEqual(r2.barcode, '5684848452326');
    });

    test('rejects unknown or phantom QR codes (e.g. 53636636373363 or 99)', async () => {
      const customerCookie = makeSignedAuthCookie({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
      const res = await makeRequest(app, {
        path: '/api/fitting-rooms/53636636373363/enter',
        method: 'POST'
      }, { customerPresent: true }, customerCookie);

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /รหัสห้องลองไม่ถูกต้อง/);
    });
  });

  describe('T06 / BUG-006: Atomic Room Lifecycle, Same-Owner Resume & Scoped Release', () => {
    beforeEach(() => {
      resetMockDb();
    });

    const customer1Cookie = makeSignedAuthCookie({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
    const customer2Cookie = makeSignedAuthCookie({ id: 'cus_002', name: 'Bob', role: 'CUSTOMER' });

    test('Customer 1 successfully enters Room 1 and receives a session ID', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.success, true);
      assert.ok(res.body.sessionId);
      assert.strictEqual(res.body.customerPresent, true);
    });

    test('Customer 1 re-entering Room 1 resumes existing session without 409 conflict', async () => {
      const enterRes1 = await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);
      assert.strictEqual(enterRes1.status, 200);
      const originalSession = enterRes1.body.sessionId;

      const enterRes2 = await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);

      assert.strictEqual(enterRes2.status, 200);
      assert.strictEqual(enterRes2.body.resumed, true);
      assert.strictEqual(enterRes2.body.sessionId, originalSession);
    });

    test('Customer 2 entering Room 1 while occupied is rejected with 409 conflict', async () => {
      await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);

      const res = await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer2Cookie);

      assert.strictEqual(res.status, 409);
      assert.match(res.body.error, /ห้องลองนี้มีลูกค้าท่านอื่นใช้งานอยู่/);
    });

    test('Releasing Room 1 with mismatched session ID is rejected with 403 Forbidden', async () => {
      await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);

      const releaseRes = await makeRequest(app, {
        path: '/api/fitting-rooms/1/release',
        method: 'POST'
      }, { sessionId: 'wrong-session-uuid-999' }, customer1Cookie);

      assert.strictEqual(releaseRes.status, 403);
      assert.match(releaseRes.body.error, /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน/);
    });

    test('Releasing Room 1 with valid matching session ID marks room released', async () => {
      const enterRes = await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customer1Cookie);

      const sessionId = enterRes.body.sessionId;

      const releaseRes = await makeRequest(app, {
        path: '/api/fitting-rooms/1/release',
        method: 'POST'
      }, { sessionId }, customer1Cookie);

      assert.strictEqual(releaseRes.status, 200);
      assert.strictEqual(releaseRes.body.success, true);
    });

    test('entering a room runs no SQL and records the owner in memory, no order row', async () => {
      const seen = [];
      setMockHandler(async (op, sql) => { seen.push(sql); throw new Error('enter must not run SQL'); });
      try {
        const res = await makeRequest(app, {
          path: '/api/fitting-rooms/1/enter',
          method: 'POST'
        }, {}, customer1Cookie);
        assert.strictEqual(res.status, 200);
        assert.strictEqual(seen.length, 0);
        assert.strictEqual(mockFittingRoomRows.length, 0);
        assert.strictEqual(roomOccupancy.get('1').cusId, 'cus_001');
        assert.strictEqual(roomOccupancy.get('1').sessionId, res.body.sessionId);
      } finally {
        setMockHandler(handleMockQuery);
      }
    });

    test('rooms 5 and 10 can be entered by QR barcode, 11 is rejected', async () => {
      const r5 = await makeRequest(app, { path: '/api/fitting-rooms/5684848452329/enter', method: 'POST' }, {}, customer1Cookie);
      assert.strictEqual(r5.status, 200);
      assert.strictEqual(r5.body.roomDisplay, '5');
      const r10 = await makeRequest(app, { path: '/api/fitting-rooms/10/enter', method: 'POST' }, {}, customer2Cookie);
      assert.strictEqual(r10.status, 200);
      assert.strictEqual(r10.body.roomDisplay, '10');
      const r11 = await makeRequest(app, { path: '/api/fitting-rooms/11/enter', method: 'POST' }, {}, customer1Cookie);
      assert.strictEqual(r11.status, 400);
    });

    test('GET /fitting-rooms reflects in-memory occupancy and isMyRoom', async () => {
      await makeRequest(app, { path: '/api/fitting-rooms/1/enter', method: 'POST' }, {}, customer1Cookie);
      const mine = await makeRequest(app, { path: '/api/fitting-rooms' }, null, customer1Cookie);
      const theirs = await makeRequest(app, { path: '/api/fitting-rooms' }, null, customer2Cookie);
      assert.strictEqual(mine.body.length, 10);
      assert.strictEqual(mine.body.find(r => r.roomNumber === '1').isMyRoom, true);
      assert.strictEqual(theirs.body.find(r => r.roomNumber === '1').isMyRoom, false);
      assert.strictEqual(theirs.body.find(r => r.roomNumber === '1').isOccupied, true);
      assert.strictEqual(theirs.body.find(r => r.roomNumber === '2').isOccupied, false);
    });

    test('after release the room is free for another customer', async () => {
      const e = await makeRequest(app, { path: '/api/fitting-rooms/1/enter', method: 'POST' }, {}, customer1Cookie);
      await makeRequest(app, { path: '/api/fitting-rooms/1/release', method: 'POST' }, { sessionId: e.body.sessionId }, customer1Cookie);
      const res = await makeRequest(app, { path: '/api/fitting-rooms/1/enter', method: 'POST' }, {}, customer2Cookie);
      assert.strictEqual(res.status, 200);
    });

    test('releasing a room you do not hold is 403 and keeps the lock', async () => {
      const enter = await makeRequest(app, { path: '/api/fitting-rooms/1/enter', method: 'POST' }, {}, customer1Cookie);
      const res = await makeRequest(app, { path: '/api/fitting-rooms/1/release', method: 'POST' }, {}, customer2Cookie);
      assert.strictEqual(res.status, 403);
      assert.strictEqual(roomOccupancy.get('1').cusId, 'cus_001');
      assert.strictEqual(roomOccupancy.get('1').sessionId, enter.body.sessionId);
    });

    test('ordering without holding the room is 403', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-orders', method: 'POST' },
        { roomId: '1', sku: '8850010110001' }, customer2Cookie);
      assert.strictEqual(res.status, 403);
    });
  });

  describe('T04 & T05 / BUG-004 & BUG-005: Fitting Order Validation & Timestamps', () => {
    beforeEach(async () => {
      resetMockDb();
      // Customer 1 enters room 1 to acquire active session
      const customerCookie = makeSignedAuthCookie({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
      await makeRequest(app, {
        path: '/api/fitting-rooms/1/enter',
        method: 'POST'
      }, { customerPresent: true }, customerCookie);
    });

    const customerCookie = makeSignedAuthCookie({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
    const staffCookie = makeSignedAuthCookie({ id: '68070056', name: 'Staff Member', role: 'FITTING_STAFF' });

    test('rejects fitting order when size and color do not match SKU variant (400 VARIANT_MISMATCH)', async () => {
      // SKU 8850010110001 is Black / M. Submitting White / L with this SKU must fail.
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '1',
        sku: '8850010110001',
        size: 'L',
        color: 'White'
      }, customerCookie);

      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.body.error.code, 'VARIANT_MISMATCH');
    });

    test('accepts fitting order with strictly matched SKU variant', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '1',
        sku: '8850010110001',
        size: 'M',
        color: 'Black'
      }, customerCookie);

      assert.strictEqual(res.status, 200);
      assert.ok(res.body.id);
      assert.strictEqual(res.body.status, 'pending');
      assert.strictEqual(res.body.size, 'M');
      assert.strictEqual(res.body.color, 'Black');
    });

    test('staff completing an order sets finish timestamp idempotently', async () => {
      const orderRes = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '1',
        sku: '8850010110001',
        size: 'M',
        color: 'Black'
      }, customerCookie);

      const orderId = orderRes.body.id;

      // CONTRACT CHANGE: pending must be claimed before it can be completed.
      const claim = await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'preparing' }, staffCookie);
      assert.strictEqual(claim.status, 200);

      // Staff completes order
      const patchRes1 = await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'complete' }, staffCookie);

      assert.strictEqual(patchRes1.status, 200);
      assert.strictEqual(patchRes1.body.status, 'complete');
      assert.ok(patchRes1.body.finishedAt);
      const firstFinishTime = patchRes1.body.finishedAt;

      // Repeat patch - finish timestamp must remain immutable
      const patchRes2 = await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'complete' }, staffCookie);

      assert.strictEqual(patchRes2.status, 200);
      assert.strictEqual(patchRes2.body.finishedAt, firstFinishTime);
    });

    test('staff cannot skip from pending straight to complete (409) or roll back to pending', async () => {
      const orderRes = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '1',
        sku: '8850010110001',
        size: 'M',
        color: 'Black'
      }, customerCookie);

      const orderId = orderRes.body.id;

      const skip = await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'complete' }, staffCookie);
      assert.strictEqual(skip.status, 409);
      assert.strictEqual(skip.body.error, 'INVALID_TRANSITION');

      await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'preparing' }, staffCookie);

      const rollback = await makeRequest(app, {
        path: `/api/fitting-orders/${orderId}`,
        method: 'PATCH'
      }, { status: 'pending' }, staffCookie);
      assert.strictEqual(rollback.status, 409);
      assert.strictEqual(rollback.body.error, 'INVALID_TRANSITION');
    });

    test('staff order list includes finishedAt for completed orders', async () => {
      const orderRes = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '1',
        sku: '8850010110001',
        size: 'M',
        color: 'Black'
      }, customerCookie);

      await makeRequest(app, {
        path: `/api/fitting-orders/${orderRes.body.id}`,
        method: 'PATCH'
      }, { status: 'preparing' }, staffCookie);

      await makeRequest(app, {
        path: `/api/fitting-orders/${orderRes.body.id}`,
        method: 'PATCH'
      }, { status: 'complete' }, staffCookie);

      const listRes = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'GET'
      }, null, staffCookie);

      assert.strictEqual(listRes.status, 200);
      assert.ok(Array.isArray(listRes.body));
      const finished = listRes.body.find(o => o.id === orderRes.body.id);
      assert.ok(finished);
      assert.ok(finished.finishedAt);
    });
  });

  describe('T02 / BUG-002: Cart Image & Sync', () => {
    beforeEach(() => {
      resetMockDb();
    });

    const userCookie = makeSignedAuthCookie({ id: 'cus_cart_01', name: 'Charlie', role: 'CUSTOMER' });

    test('POST /api/cart rejects invalid quantity <= 0 (400)', async () => {
      const res = await makeRequest(app, {
        path: '/api/cart',
        method: 'POST'
      }, { items: [{ sku: '8850010110001', quantity: 0 }] }, userCookie);

      assert.strictEqual(res.status, 400);
      assert.match(res.body.error, /Invalid quantity/);
    });

    test('POST /api/cart rejects unknown SKU with 404', async () => {
      const res = await makeRequest(app, {
        path: '/api/cart',
        method: 'POST'
      }, { items: [{ sku: '8888888888888', quantity: 1 }] }, userCookie);

      assert.strictEqual(res.status, 404);
      assert.match(res.body.error, /Invalid SKU/);
    });

    test('POST /api/cart stores items and GET /api/cart returns productId, tag, and image', async () => {
      const addRes = await makeRequest(app, {
        path: '/api/cart',
        method: 'POST'
      }, { items: [{ sku: '8850010110001', quantity: 2 }] }, userCookie);

      assert.strictEqual(addRes.status, 200);
      assert.strictEqual(addRes.body.success, true);

      const getRes = await makeRequest(app, {
        path: '/api/cart',
        method: 'GET'
      }, null, userCookie);

      assert.strictEqual(getRes.status, 200);
      assert.strictEqual(getRes.body.items.length, 1);
      const item = getRes.body.items[0];
      assert.strictEqual(item.sku, '8850010110001');
      assert.strictEqual(item.productId, 'p1');
      assert.strictEqual(item.tag, 'shirt');
      assert.ok(item.image);
      assert.strictEqual(item.quantity, 2);
    });
  });

  describe('T03 / BUG-003: Skirt Categorization Audit & Migration Integrity', () => {
    test('database/seed.js classifies skirt items p52, p54, p56, p58, p60 as female', () => {
      const seedContent = fs.readFileSync(path.join(__dirname, '../database/seed.js'), 'utf8');
      const productsMatch = seedContent.match(/const products = (\[[\s\S]*?\]);/);
      assert.ok(productsMatch, 'products array found in seed.js');
      const products = JSON.parse(productsMatch[1]);

      const skirtIds = ['p52', 'p54', 'p56', 'p58', 'p60'];
      for (const id of skirtIds) {
        const item = products.find(i => i.id === id);
        assert.ok(item, `Item ${id} must exist in seed.js`);
        assert.strictEqual(item.category, 'female', `Item ${id} category must be 'female'`);
        assert.strictEqual(item.tag, 'skirt', `Item ${id} tag must be 'skirt'`);
      }
    });
  });

  describe('Audit Finding: Cart Wipe Prevention on Login', () => {
    test('routes/auth.js does not wipe PAY_CART_ITEM on customer login', () => {
      const authFileContent = fs.readFileSync(path.join(__dirname, '../routes/auth.js'), 'utf8');
      assert.strictEqual(
        authFileContent.includes('DELETE FROM PAY_CART_ITEM WHERE CUS_ID = ?'),
        false,
        'routes/auth.js must not wipe cart items on customer login'
      );
    });
  });
});
