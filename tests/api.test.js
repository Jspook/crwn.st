// ==========================================================
// Automated Integration & API Test Suite for crwn.st
// Using Node.js Native Test Runner (node:test & node:assert)
// ==========================================================

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

    test('GET /api/fitting-rooms returns 4 rooms with 13-digit identifiers and clean 1-4 roomDisplay', async () => {
      const res = await makeRequest(app, { path: '/api/fitting-rooms' });
      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body));
      assert.equal(res.body.length, 4);
      assert.equal(res.body[0].FTR_Num, '5684848452325');
      assert.equal(res.body[0].roomDisplay, '1');
      assert.equal(res.body[1].FTR_Num, '5684848452326');
      assert.equal(res.body[1].roomDisplay, '2');
      assert.equal(res.body[2].FTR_Num, '5684848452327');
      assert.equal(res.body[2].roomDisplay, '3');
      assert.equal(res.body[3].FTR_Num, '5684848452328');
      assert.equal(res.body[3].roomDisplay, '4');
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

    test('POST /api/fitting-rooms/:roomId/release clears room occupancy', async () => {
      const customerCookie = makeSignedAuthCookie({
        id: realCusId || '68070001',
        name: 'สมชาย สายช้อป',
        role: 'CUSTOMER'
      });

      const releaseRes = await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/release`,
        method: 'POST'
      }, {}, customerCookie);
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
      await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/enter`,
        method: 'POST'
      }, {}, customerCookie);
    });

    after(async () => {
      // Clean up room
      await makeRequest(app, {
        path: `/api/fitting-rooms/${testRoomId}/release`,
        method: 'POST'
      }, {}, customerCookie);
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
        password: 'wrong_password_xyz'
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
});
