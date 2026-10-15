const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

process.env.USE_MOCK_DB = 'true';
const { setMockHandler } = require('../database/db');
const apiRoutes = require('../routes/api');
const secret = 'mock_only_secret_for_room_alias_tests';
const app = express();
app.use(express.json());
app.use(cookieParser(secret));
app.use('/api', apiRoutes);
after(() => { setMockHandler(null); });

function cookie() {
  const signed = 's:' + cookieSignature.sign(JSON.stringify({ id: 'u1', role: 'CUSTOMER' }), secret);
  return 'crwn_auth=' + encodeURIComponent(signed);
}

async function fetchOrders(server, roomId) {
  return await new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: server.address().port,
      path: `/api/fitting-orders?roomId=${encodeURIComponent(roomId)}`,
      headers: { Cookie: cookie() } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
    });
    req.on('error', reject);
  });
}

test('customer GET without roomId fails closed (400) and never touches the orders query', async () => {
  const calls = [];
  setMockHandler(async (operation, sql) => { calls.push({ operation, sql }); throw new Error('must not query'); });
  const server = app.listen(0);
  try {
    const response = await new Promise((resolve, reject) => {
      http.get({ host: '127.0.0.1', port: server.address().port, path: '/api/fitting-orders',
        headers: { Cookie: cookie() } }, res => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(response.status, 400);
    assert.equal(calls.length, 0, 'no SQL may run before roomId is validated');
  } finally {
    await new Promise(resolve => server.close(resolve));
    setMockHandler(null);
  }
});

test('barcode and number look up the same canonical FITTING_ROOM.FTR_Number', async () => {
  const seen = [];
  setMockHandler(async (operation, sql, params) => {
    if (operation === 'get' && sql.includes('FITTING_ROOM_SLOT')) {
      assert.deepEqual(params, ['1']);
      return { FTR_SessionID: 'ses_current', CUS_ID: 'u1' };
    }
    assert.equal(operation, 'query');
    seen.push({ sql, params });
    assert.ok(sql.includes('slot.FTR_ActiveSessionID = f.FTR_SessionID'));
    assert.deepEqual(params, ['1', 'ses_current', 'u1']);
    return [{ id: 'fo_pending', roomId: '1', status: 'pending', sku: 'sku1' }];
  });
  const server = app.listen(0);
  try {
    const barcode = await fetchOrders(server, '5684848452325');
    const number = await fetchOrders(server, '1');
    assert.equal(barcode.status, 200);
    assert.equal(number.status, 200);
    assert.deepEqual(barcode.body.map(o => o.id), ['fo_pending']);
    assert.deepEqual(number.body.map(o => o.id), ['fo_pending']);
    assert.ok(seen.every(call => call.sql.includes('f.FTR_Number')));
  } finally {
    await new Promise(resolve => server.close(resolve));
    setMockHandler(null);
  }
});
