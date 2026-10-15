// Customer GET /api/fitting-orders: roomId handling and barcode/number aliasing.
const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

process.env.USE_MOCK_DB = 'true';
const { setMockHandler } = require('../database/db');
const { roomOccupancy } = require('../utils/roomOccupancy');
const apiRoutes = require('../routes/api');
const secret = 'mock_only_secret_for_room_alias_tests';
const app = express();
app.use(express.json());
app.use(cookieParser(secret));
app.use('/api', apiRoutes);
beforeEach(() => { roomOccupancy.clear(); setMockHandler(null); });
after(() => { roomOccupancy.clear(); setMockHandler(null); });

function cookie() {
  const signed = 's:' + cookieSignature.sign(JSON.stringify({ id: 'u1', role: 'CUSTOMER' }), secret);
  return 'crwn_auth=' + encodeURIComponent(signed);
}

function get(server, path) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port: server.address().port, path, headers: { Cookie: cookie() } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    }).on('error', reject);
  });
}

test('customer GET without roomId fails closed (400) and runs no SQL', async () => {
  const calls = [];
  setMockHandler(async (operation, sql) => { calls.push({ operation, sql }); throw new Error('must not query'); });
  const server = app.listen(0);
  try {
    const response = await get(server, '/api/fitting-orders');
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('barcode and number address the same room: same rows, room params are [number, barcode]', async () => {
  roomOccupancy.acquire('1', 'u1');
  const seen = [];
  setMockHandler(async (operation, sql, params) => {
    assert.equal(operation, 'query');
    seen.push({ sql, params });
    return [{ id: 'fo_pending', roomId: '1', status: 'pending', sku: 'sku1', createdAt: new Date(), cusId: 'u1' }];
  });
  const server = app.listen(0);
  try {
    const barcode = await get(server, '/api/fitting-orders?roomId=5684848452325');
    const number = await get(server, '/api/fitting-orders?roomId=1');
    assert.equal(barcode.status, 200);
    assert.equal(number.status, 200);
    assert.deepEqual(barcode.body.map(o => o.id), ['fo_pending']);
    assert.deepEqual(number.body.map(o => o.id), ['fo_pending']);
    assert.equal(seen.length, 2);
    for (const call of seen) {
      assert.ok(call.sql.includes('f.FTR_Number'));
      assert.deepEqual(call.params.slice(0, 3), ['1', '5684848452325', 'u1']);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('customer GET for a room they do not hold is [] without SQL', async () => {
  roomOccupancy.acquire('1', 'someone_else');
  setMockHandler(async () => { throw new Error('must not query'); });
  const server = app.listen(0);
  try {
    const response = await get(server, '/api/fitting-orders?roomId=1');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});

test('customer GET with an unresolvable roomId is 200 []', async () => {
  setMockHandler(async () => { throw new Error('must not query'); });
  const server = app.listen(0);
  try {
    const response = await get(server, '/api/fitting-orders?roomId=99');
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, []);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
