// ==========================================================
// Automated Integration & API Test Suite for crwn.st
// Using Node.js Native Test Runner (node:test & node:assert)
// ==========================================================

require('dotenv').config();

// Safety Guard: Abort if pointed at live/production database
const LIVE_HOSTS = ['webdev.it.kmitl.ac.th', '10.0.30.22'];
const LIVE_DB = 's68070186';
if (
  (LIVE_HOSTS.includes(process.env.DB_HOST) || process.env.DB_NAME === LIVE_DB) &&
  process.env.ISOLATED_TEST_DB !== 'true'
) {
  console.error('\n❌ [SAFETY ABORT] tests/api.test.js cannot run against live production DB (' + process.env.DB_HOST + ' / ' + process.env.DB_NAME + ').');
  console.error('Please configure an isolated test database or set ISOLATED_TEST_DB=true with non-production credentials.\n');
  process.exit(1);
}

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');
const apiRouter = require('../routes/api');
const authRouter = require('../routes/auth');
const { query, get, run } = require('../database/db');

const TEST_SECRET = process.env.COOKIE_SECRET || 'test_secret_32_characters_minimum_length_abcdef';

// Helper to construct signed auth cookies matching middleware/auth.js
function makeSignedAuthCookie(user, secret = TEST_SECRET) {
  const val = JSON.stringify(user);
  const signed = 's:' + cookieSignature.sign(val, secret);
  return `crwn_auth=${encodeURIComponent(signed)}`;
}

// Helper to make test HTTP requests against Express app
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

// Setup test app instance
function createTestApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser(TEST_SECRET));
  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);
  return app;
}

const app = createTestApp();

describe('crwn.st API & Security Suite', () => {
  let realCusId = null;
  let realEmpId = null;

  before(async () => {
    const customer = await get(`SELECT CUS_ID, CUS_FName FROM CUSTOMER LIMIT 1`);
    if (customer) {
      realCusId = customer.CUS_ID;
    }
    const emp = await get(`SELECT EMP_ID, EMP_FName FROM EMPLOYEE LIMIT 1`);
    if (emp) {
      realEmpId = emp.EMP_ID;
    }
  });

  // --------------------------------------------------------------------------
  // 1. Barcode & Product Lookup (Defects #10 & #11)
  // --------------------------------------------------------------------------
  describe('1. Product & Barcode Lookup (13-digit EAN-13 & Exact Match)', () => {
    test('GET /api/products returns seeded products with variants', async () => {
      const res = await makeRequest(app, { path: '/api/products' });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.ok(res.body.length > 0, 'Should have seeded products');
      const first = res.body[0];
      assert.ok(first.ITM_ID || first.id);
      assert.ok(Array.isArray(first.variants));
    });

    test('GET /api/products/barcode/:code with valid SKU returns exact product variant', async () => {
      const variant = await get(`SELECT ITV_SKUID, ITM_ID FROM ITEM_VARIANT LIMIT 1`);
      assert.ok(variant, 'Should have at least one variant in DB');

      const res = await makeRequest(app, { path: `/api/products/barcode/${variant.ITV_SKUID}` });
      assert.equal(res.status, 200);
      assert.equal(res.body.id, variant.ITM_ID);
      assert.equal(res.body.variants[0].sku, variant.ITV_SKUID);
    });

    test('GET /api/products/barcode/:code with non-existent barcode returns 404 (No fake fallback)', async () => {
      const invalidCode = '9999999999999';
      const res = await makeRequest(app, { path: `/api/products/barcode/${invalidCode}` });
      assert.equal(res.status, 404);
      assert.ok(res.body.error, 'Should return error message');
      assert.match(res.body.error, /ไม่พบสินค้าจากบาร์โค้ดนี้/);
    });
  });

  // --------------------------------------------------------------------------
  // 2. Fitting Rooms & Occupancy Tracking (Defects #2 & #10)
  // --------------------------------------------------------------------------
  describe('2. Fitting Rooms Occupancy & 13-Digit Room IDs', () => {
    const testRoomId = '5684848452325'; // 13-digit room ID

    test('GET /api/fitting-rooms returns 10 rooms with 13-digit identifiers and clean roomDisplay', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-rooms' });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      // The registry now covers all 10 physical rooms (see utils/roomResolver ROOM_BARCODES).
      assert.equal(res.body.length, 10);
      res.body.forEach((room, i) => {
        const n = i + 1;
        assert.equal(room.roomNumber, String(n));
        assert.equal(room.FTR_Num, String(5684848452324 + n));
        assert.equal(room.roomDisplay, String(n));
      });
    });

    test('POST /api/fitting-rooms/:roomId/enter without customer cookie returns 403', async () => {
      const res = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      });
      assert.equal(res.status, 403);
    });

    test('POST /api/fitting-rooms/:roomId/enter with customer session marks room occupied', async () => {
      const customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });

      const enterRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      }, {}, customerCookie);

      assert.equal(enterRes.status, 200);
      assert.equal(enterRes.body.customerPresent, true);

      // Verify room status is now occupied
      const statusRes = await makeRequest(app, { path: '/api/fitting-rooms' });
      const room = statusRes.body.find(r => r.FTR_Num === testRoomId);
      assert.ok(room);
      assert.equal(room.isOccupied, true);
      assert.equal(room.FTR_Status, 'occupied');
    });

    test('POST /api/fitting-rooms/:roomId/release without a sessionId is rejected (403)', async () => {
      const customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });

      const enterRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      }, {}, customerCookie);
      assert.equal(enterRes.status, 200);

      // Policy: a customer release must name the session it is releasing. Depending on whether the
      // room already holds a session for this customer, the server answers SESSION_MISMATCH or
      // NOT_ACTIVE — both are 403 and neither may free the room.
      const releaseRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/release`,
        method: 'POST'
      }, {}, customerCookie);
      assert.equal(releaseRes.status, 403);
      assert.match(String(releaseRes.body.error), /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน|no active fitting room session/);

      const statusRes = await makeRequest(app, { path: '/api/fitting-rooms' });
      const room = statusRes.body.find(r => r.FTR_Num === testRoomId);
      assert.equal(room.isOccupied, true, 'a rejected release must not free the room');
    });

    test('POST /api/fitting-rooms/:roomId/release clears room occupancy', async () => {
      const customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });

      // Re-acquire to get the session this customer currently holds, then release exactly that one.
      const enterRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      }, {}, customerCookie);
      assert.equal(enterRes.status, 200);
      assert.ok(enterRes.body.sessionId);

      const releaseRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/release`,
        method: 'POST'
      }, { sessionId: enterRes.body.sessionId }, customerCookie);
      assert.equal(releaseRes.status, 200);

      // Verify room is now available
      const statusRes = await makeRequest(app, { path: '/api/fitting-rooms' });
      const room = statusRes.body.find(r => r.FTR_Num === testRoomId);
      assert.ok(room);
      assert.equal(room.isOccupied, false);
      assert.equal(room.FTR_Status, 'available');
    });
  });

  // --------------------------------------------------------------------------
  // 3. Fitting Room Orders & Queue Management
  // --------------------------------------------------------------------------
  describe('3. Fitting Room Orders & Queue Management', () => {
    let testSku;
    let createdOrderId;
    let sessionId;
    const testRoomId = '5684848452325';
    let customerCookie;
    let staffCookie;

    before(async () => {
      const variant = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_Stock > 0 LIMIT 1`);
      testSku = variant.ITV_SKUID;

      customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });

      staffCookie = makeSignedAuthCookie({
        id: realEmpId || '68070056',
        name: 'จิรภัทร ชาญวิทย์',
        role: 'FITTING_STAFF'
      });

      // Customer enters room first to establish session
      const enterRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      }, {}, customerCookie);
      sessionId = enterRes.body && enterRes.body.sessionId;
    });

    after(async () => {
      // Clean up room — release is session-scoped, so pass the session acquired above.
      await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/release`,
        method: 'POST'
      }, sessionId ? { sessionId } : {}, customerCookie);
    });

    test('POST /api/fitting-orders with missing/invalid SKU rejects with 400', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, { roomId: testRoomId, sku: 'NON_EXISTENT_SKU_999' }, customerCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'INVALID_SKU');
    });

    test('POST /api/fitting-orders with valid in-stock SKU creates pending order', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, { roomId: testRoomId, sku: testSku }, customerCookie);

      assert.equal(res.status, 200);
      assert.ok(res.body.id);
      assert.equal(res.body.status, 'pending');
      createdOrderId = res.body.id;
    });

    test('POST /api/fitting-orders with 0 stock item is rejected with OUT_OF_STOCK', async () => {
      const zeroVariant = await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_Stock = 0 LIMIT 1`);
      let zeroSku = zeroVariant ? zeroVariant.ITV_SKUID : null;

      if (!zeroSku) {
        const anyVar = await get(`SELECT ITV_SKUID, ITV_Stock FROM ITEM_VARIANT LIMIT 1`);
        zeroSku = anyVar.ITV_SKUID;
        const originalStock = anyVar.ITV_Stock;
        await run(`UPDATE ITEM_VARIANT SET ITV_Stock = 0 WHERE ITV_SKUID = ?`, [zeroSku]);

        const res = await makeRequest(app, {
          path: '/api/fitting-orders',
          method: 'POST'
        }, { roomId: testRoomId, sku: zeroSku }, customerCookie);

        await run(`UPDATE ITEM_VARIANT SET ITV_Stock = ? WHERE ITV_SKUID = ?`, [originalStock, zeroSku]);

        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'OUT_OF_STOCK');
      } else {
        const res = await makeRequest(app, {
          path: '/api/fitting-orders',
          method: 'POST'
        }, { roomId: testRoomId, sku: zeroSku }, customerCookie);

        assert.equal(res.status, 400);
        assert.equal(res.body.error.code, 'OUT_OF_STOCK');
      }
    });

    test('GET /api/fitting-orders reflects newly created pending order for staff', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-orders' }, null, staffCookie);
      assert.equal(res.status, 200);
      const target = res.body.find(o => o.id === createdOrderId);
      assert.ok(target, 'Created order should be in list');
      assert.equal(target.status, 'pending');
      assert.equal(target.roomDisplay, '1');

      const dummyRows = res.body.filter(o => !o.sku || o.sku === 'null');
      assert.equal(dummyRows.length, 0, 'No dummy occupancy rows should appear in fitting orders');
    });

    test('PATCH /api/fitting-orders/:id transitions status pending -> preparing -> complete', async () => {
      // 1. Move to preparing
      const prepRes = await makeRequest(app, {
        path: `/api/fitting-orders/${createdOrderId}`,
        method: 'PATCH'
      }, { status: 'preparing' }, staffCookie);

      assert.equal(prepRes.status, 200);
      assert.equal(prepRes.body.status, 'preparing');

      // 2. Complete order
      const compRes = await makeRequest(app, {
        path: `/api/fitting-orders/${createdOrderId}`,
        method: 'PATCH'
      }, { status: 'complete' }, staffCookie);

      assert.equal(compRes.status, 200);
      assert.equal(compRes.body.status, 'complete');
    });

    test('GET /api/fitting-orders?limit=1 caps completed orders correctly', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-orders?limit=1' }, null, staffCookie);
      assert.equal(res.status, 200);
      const completes = res.body.filter(o => o.status === 'complete');
      assert.ok(completes.length <= 1, 'Completed orders must not exceed limit param');
    });
  });

  // --------------------------------------------------------------------------
  // 4. POS Checkout, 7% VAT Calculation & Stock Deduction
  // --------------------------------------------------------------------------
  describe('4. POS Checkout, 7% VAT & Atomic Stock Deduction', () => {
    let buySku;
    let initialStock;
    let unitPrice;
    let cashierCookie;

    before(async () => {
      cashierCookie = makeSignedAuthCookie({
        id: realEmpId || '68070254',
        name: 'พนักงาน แคชเชียร์',
        role: 'CASHIER'
      });

      const variant = await get(`
        SELECT v.ITV_SKUID, v.ITV_Stock, i.ITM_Price 
        FROM ITEM_VARIANT v 
        JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
        WHERE v.ITV_Stock >= 5 
        LIMIT 1
      `);
      buySku = variant.ITV_SKUID;
      initialStock = Number(variant.ITV_Stock);
      unitPrice = Number(variant.ITM_Price);
    });

    test('POST /api/receipts calculates exact 7% VAT into ORD_Total and deducts stock', async () => {
      const qtyToBuy = 2;
      const expectedTotal = unitPrice * qtyToBuy;

      const res = await makeRequest(app, {
        path: '/api/receipts',
        method: 'POST'
      }, {
        paymentMethod: 'cash',
        memberId: realCusId || null,
        items: [{ sku: buySku, quantity: qtyToBuy }]
      }, cashierCookie);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const receiptId = res.body.id;

      const orderDb = await get(`SELECT * FROM SALE_ORDER WHERE ORD_ID = ?`, [receiptId]);
      assert.ok(orderDb, 'Order must exist in database');
      if (realCusId) {
        assert.equal(orderDb.CUS_ID, realCusId);
      }
      assert.equal(orderDb.ORD_Channel, 'pos_cashier');
      assert.ok(Math.abs(orderDb.ORD_Total - expectedTotal) < 0.01);

      const updatedVariant = await get(`SELECT ITV_Stock FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [buySku]);
      assert.equal(Number(updatedVariant.ITV_Stock), initialStock - qtyToBuy);
    });

    test('POST /api/receipts rejects order when requested quantity exceeds stock', async () => {
      const currentVariant = await get(`SELECT ITV_Stock FROM ITEM_VARIANT WHERE ITV_SKUID = ?`, [buySku]);
      const currentStock = Number(currentVariant.ITV_Stock);
      const excessiveQty = currentStock + 999;

      const res = await makeRequest(app, {
        path: '/api/receipts',
        method: 'POST'
      }, {
        paymentMethod: 'cash',
        items: [{ sku: buySku, quantity: excessiveQty }]
      }, cashierCookie);

      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'OUT_OF_STOCK');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Security & Privilege Escalation Defenses (QA Findings F-1 to F-7)
  // --------------------------------------------------------------------------
  describe('5. Security Guard & Access Control Verification', () => {
    let cashierCookie;
    let customerCookie;
    let otherCustomerCookie;

    before(() => {
      cashierCookie = makeSignedAuthCookie({
        id: realEmpId || '68070254',
        name: 'พนักงาน แคชเชียร์',
        role: 'CASHIER'
      });
      customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });
      otherCustomerCookie = makeSignedAuthCookie({
        id: 'other_customer_999',
        name: 'คนอื่น',
        role: 'CUSTOMER'
      });
    });

    test('F-1: Unsigned/tampered cookie privilege escalation is blocked (401)', async () => {
      // Attacker sends forged unsigned cookie trying to claim CASHIER role
      const forgedCookie = 'crwn_auth=' + encodeURIComponent(JSON.stringify({
        id: 'h4x0r',
        name: 'Hacker',
        role: 'CASHIER'
      }));

      const res = await makeRequest(app, { path: '/api/receipts' }, null, forgedCookie);
      assert.equal(res.status, 401, 'Forged cookie must be rejected');
    });

    test('F-2: GET /api/users rejects unauthenticated access with 401', async () => {
      const res = await makeRequest(app, { path: '/api/users' });
      assert.equal(res.status, 401);
    });

    test('F-2: GET /api/users rejects CUSTOMER access with 403', async () => {
      const res = await makeRequest(app, { path: '/api/users' }, null, customerCookie);
      assert.equal(res.status, 403);
    });

    test('F-2: GET /api/users requires phone parameter and returns exact match for CASHIER', async () => {
      const resNoPhone = await makeRequest(app, { path: '/api/users' }, null, cashierCookie);
      assert.equal(resNoPhone.status, 200);
      assert.deepEqual(resNoPhone.body, [], 'Without valid phone should return empty array, not full dump');
    });

    test('F-2: GET /api/receipts rejects unauthenticated access with 401', async () => {
      const res = await makeRequest(app, { path: '/api/receipts' });
      assert.equal(res.status, 401);
    });

    test('F-3: GET /api/receipts/:id rejects IDOR attempt by non-owner customer (404)', async () => {
      const order = await get(`SELECT ORD_ID FROM SALE_ORDER WHERE CUS_ID = ? LIMIT 1`, [realCusId || '68070001']);
      if (order) {
        // Other customer tries to view this receipt
        const res = await makeRequest(app, { path: `/api/receipts/${order.ORD_ID}` }, null, otherCustomerCookie);
        assert.equal(res.status, 404, 'Must return 404 to avoid receipt existence enumeration');
      }
    });

    test('F-4: POST /api/receipts rejects unauthenticated order placement (401)', async () => {
      const res = await makeRequest(app, {
        path: '/api/receipts',
        method: 'POST'
      }, {
        paymentMethod: 'cash',
        items: [{ sku: 'any_sku', quantity: 1 }]
      });
      assert.equal(res.status, 401, 'Anonymous receipt placement must be blocked');
    });

    test('F-5: Employee login with invalid password does not trigger ID-as-password backdoor', async () => {
      const res = await makeRequest(app, {
        path: '/api/auth/login',
        method: 'POST'
      }, {
        identifier: '68070254',
        password: process.env.TEST_INVALID_PASSWORD || 'wrong-password-for-test'
      });
      assert.equal(res.status, 401, 'Wrong password must fail authentication');
    });

    test('F-7: POST /api/fitting-orders rejects unauthenticated request with 401', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '5684848452325',
        sku: 'any_sku'
      });
      assert.equal(res.status, 401);
    });

    test('F-7: POST /api/fitting-orders rejects non-customer with 403', async () => {
      const res = await makeRequest(app, {
        path: '/api/fitting-orders',
        method: 'POST'
      }, {
        roomId: '5684848452325',
        sku: 'any_sku'
      }, cashierCookie);
      assert.equal(res.status, 403);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Durable session expiry (real MySQL only — closes the E2 gap)
  // --------------------------------------------------------------------------
  describe('6. Durable Session Expiry & Reaping', () => {
    const room2 = '5684848452326';
    let customerCookie;
    let staffCookie;
    let sessionId;
    let expiredOrderId;

    before(async () => {
      customerCookie = makeSignedAuthCookie({ id: realCusId || '68070001', name: 'สมชาย สายช้อป', role: 'CUSTOMER' });
      staffCookie = makeSignedAuthCookie({ id: realEmpId || '68070056', name: 'จิรภัทร ชาญวิทย์', role: 'FITTING_STAFF' });

      const enterRes = await makeRequest(app, { path: `/api/fitting-rooms/${room2}/enter`, method: 'POST' }, {}, customerCookie);
      assert.equal(enterRes.status, 200);
      sessionId = enterRes.body.sessionId;

      const sku = (await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_Stock > 0 LIMIT 1`)).ITV_SKUID;
      const orderRes = await makeRequest(app, { path: '/api/fitting-orders', method: 'POST' }, { roomId: room2, sku }, customerCookie);
      assert.equal(orderRes.status, 200);
      expiredOrderId = orderRes.body.id;
    });

    test('a live session keeps the pending order visible to staff', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-orders' }, null, staffCookie);
      assert.equal(res.status, 200);
      assert.ok(res.body.some(o => o.id === expiredOrderId), 'pending order visible while the session is live');
    });

    test('an expired session is reaped on release: pending cancelled, session ended, slot freed', async () => {
      // Backdate the heartbeat past the 45 minute TTL so the session counts as expired in MySQL.
      await run(`UPDATE FITTING_ROOM_SESSION SET FTR_LastSeenAt = DATE_SUB(NOW(), INTERVAL 60 MINUTE)
        WHERE FTR_SessionID = ?`, [sessionId]);

      const releaseRes = await makeRequest(app, { path: `/api/fitting-rooms/${room2}/release`, method: 'POST' }, { sessionId }, customerCookie);
      assert.equal(releaseRes.status, 403);
      assert.match(String(releaseRes.body.error), /no active fitting room session/);

      const orderRow = await get(`SELECT FTR_CancelledAt FROM FITTING_ROOM WHERE FTR_OrderID = ?`, [expiredOrderId]);
      assert.ok(orderRow.FTR_CancelledAt, 'pending order of the expired session must be cancelled');

      const sessionRow = await get(`SELECT FTR_EndedAt, FTR_EndReason FROM FITTING_ROOM_SESSION WHERE FTR_SessionID = ?`, [sessionId]);
      assert.ok(sessionRow.FTR_EndedAt, 'expired session must be ended');
      assert.equal(sessionRow.FTR_EndReason, 'EXPIRED');

      const slot = await get(`SELECT FTR_ActiveSessionID FROM FITTING_ROOM_SLOT WHERE FTR_RoomNumber = ?`, ['2']);
      assert.equal(slot.FTR_ActiveSessionID, null, 'slot must no longer pin the expired session');
    });

    test('the cancelled order disappears from the staff queue and cannot be claimed', async () => {
      const listRes = await makeRequest(app, { path: '/api/fitting-orders' }, null, staffCookie);
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.some(o => o.id === expiredOrderId), false, 'cancelled order must not be stored in the active queue');

      // The slot no longer pins a session, so withLockedActive short-circuits before reading the
      // order: the claim fails as NOT_ACTIVE (which the staff UI renders as "session ended").
      const patchRes = await makeRequest(app, { path: `/api/fitting-orders/${expiredOrderId}`, method: 'PATCH' }, { status: 'preparing' }, staffCookie);
      assert.equal(patchRes.status, 409);
      assert.equal(patchRes.body.error, 'NOT_ACTIVE');

      const orderRow = await get(`SELECT EMP_ID FROM FITTING_ROOM WHERE FTR_OrderID = ?`, [expiredOrderId]);
      assert.equal(orderRow.EMP_ID, null, 'a rejected claim must not assign the order to staff');
    });
  });

  // --------------------------------------------------------------------------
  // 7. Real concurrency on MySQL (slot locking, guarded updates, create/release race)
  // --------------------------------------------------------------------------
  describe('7. Concurrency on real MySQL', () => {
    const room3 = '5684848452327';
    const room4 = '5684848452328';
    const room5 = '5684848452329';

    let staffIds = [];

    const customerA = () => makeSignedAuthCookie({ id: realCusId || '68070001', name: 'ลูกค้า เอ', role: 'CUSTOMER' });
    const customerB = () => makeSignedAuthCookie({ id: 'race_customer_b', name: 'ลูกค้า บี', role: 'CUSTOMER' });
    // Must be real EMPLOYEE rows: FITTING_ROOM.EMP_ID has a foreign key to EMPLOYEE, so a fictional
    // staff id makes the guarded UPDATE fail with ER_NO_REFERENCED_ROW_2 (a 500, not a 409).
    const staffA = () => makeSignedAuthCookie({ id: staffIds[0], name: 'พนักงาน เอ', role: 'FITTING_STAFF' });
    const staffB = () => makeSignedAuthCookie({ id: staffIds[1], name: 'พนักงาน บี', role: 'FITTING_STAFF' });

    before(async () => {
      const rows = await query(`SELECT EMP_ID FROM EMPLOYEE ORDER BY EMP_ID LIMIT 2`);
      staffIds = rows.map(r => String(r.EMP_ID));
      assert.equal(staffIds.length, 2, 'the seeded database must provide two employees for this race');
    });

    const enterRoom = (barcode, cookie) =>
      makeRequest(app, { path: `/api/fitting-rooms/${barcode}/enter`, method: 'POST' }, {}, cookie);
    const releaseRoom = (barcode, cookie, sessionId) =>
      makeRequest(app, { path: `/api/fitting-rooms/${barcode}/release`, method: 'POST' }, { sessionId }, cookie);
    const claimOrder = (orderId, cookie) =>
      makeRequest(app, { path: `/api/fitting-orders/${orderId}`, method: 'PATCH' }, { status: 'preparing' }, cookie);
    const staffList = () => makeRequest(app, { path: '/api/fitting-orders' }, null, staffA());

    test('two customers entering the same room concurrently: exactly one wins the slot', async () => {
      const [a, b] = await Promise.all([
        enterRoom(room3, customerA()),
        enterRoom(room3, customerB()),
      ]);

      const winners = [a, b].filter(r => r.status === 200);
      assert.equal(winners.length, 1, `exactly one enter must win (got ${a.status} and ${b.status})`);
      assert.equal([a, b].filter(r => r.status === 409).length, 1, 'the loser must get 409 OCCUPIED');

      // The slot must pin the winner's session, not a blend of both.
      const slot = await get(`SELECT FTR_ActiveSessionID FROM FITTING_ROOM_SLOT WHERE FTR_RoomNumber = ?`, ['3']);
      assert.equal(slot.FTR_ActiveSessionID, winners[0].body.sessionId);

      const liveSessions = await query(
        `SELECT FTR_SessionID FROM FITTING_ROOM_SESSION WHERE FTR_RoomNumber = ? AND FTR_EndedAt IS NULL`, ['3']);
      assert.equal(liveSessions.length, 1, 'a losing enter must not leave an orphan open session');

      await releaseRoom(room3, customerA(), a.status === 200 ? a.body.sessionId : b.body.sessionId);
    });

    test('two staff claiming the same pending order concurrently: exactly one succeeds', async () => {
      const enter = await enterRoom(room4, customerA());
      assert.equal(enter.status, 200);

      const sku = (await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_Stock > 0 LIMIT 1`)).ITV_SKUID;
      const order = await makeRequest(app, { path: '/api/fitting-orders', method: 'POST' }, { roomId: room4, sku }, customerA());
      assert.equal(order.status, 200);

      const [p1, p2] = await Promise.all([
        claimOrder(order.body.id, staffA()),
        claimOrder(order.body.id, staffB()),
      ]);

      const ok = [p1, p2].filter(r => r.status === 200);
      assert.equal(ok.length, 1, `exactly one claim must succeed (got ${p1.status} and ${p2.status})`);
      assert.equal([p1, p2].filter(r => r.status === 409).length, 1, 'the loser must get 409');

      const row = await get(`SELECT EMP_ID FROM FITTING_ROOM WHERE FTR_OrderID = ?`, [order.body.id]);
      assert.ok(staffIds.includes(String(row.EMP_ID)), `claim must assign exactly one of the two staff (got ${row.EMP_ID})`);

      await releaseRoom(room4, customerA(), enter.body.sessionId);
    });

    test('creating an order while the room is being released never leaves a claimable orphan', async () => {
      const enter = await enterRoom(room5, customerA());
      assert.equal(enter.status, 200);
      const sessionId = enter.body.sessionId;
      const sku = (await get(`SELECT ITV_SKUID FROM ITEM_VARIANT WHERE ITV_Stock > 0 LIMIT 1`)).ITV_SKUID;

      const [orderRes, releaseRes] = await Promise.all([
        makeRequest(app, { path: '/api/fitting-orders', method: 'POST' }, { roomId: room5, sku }, customerA()),
        releaseRoom(room5, customerA(), sessionId),
      ]);

      assert.ok([200, 403].includes(orderRes.status),
        `create must resolve to 200 or 403, not ${orderRes.status} (server error during the race)`);
      assert.equal(releaseRes.status, 200, 'the release itself must succeed');

      // Invariant: no matter who won the race, nothing stays visible/claimable without a session.
      const list = await staffList();
      if (orderRes.status === 200) {
        const row = await get(`SELECT FTR_CancelledAt FROM FITTING_ROOM WHERE FTR_OrderID = ?`, [orderRes.body.id]);
        assert.ok(row, 'a created order must exist as history');
        assert.ok(row.FTR_CancelledAt, 'the pending order must be cancelled when its session is closed');
        assert.equal(list.body.some(o => o.id === orderRes.body.id), false, 'cancelled order must not stay in the queue');
      } else {
        assert.equal(list.body.some(o => o.roomId === '5'), false, 'a rejected create must leave no order behind');
      }

      const slot = await get(`SELECT FTR_ActiveSessionID FROM FITTING_ROOM_SLOT WHERE FTR_RoomNumber = ?`, ['5']);
      assert.equal(slot.FTR_ActiveSessionID, null, 'the room must end up free');
    });
  });
});
