const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

process.env.USE_MOCK_DB = 'true';
const { setMockHandler } = require('../database/db');
const apiRoutes = require('../routes/api');
const secret = 'mock_only_secret_for_transition_tests';
const app = express();
app.use(express.json());
app.use(cookieParser(secret));
app.use('/api', apiRoutes);
after(() => setMockHandler(null));

function staffCookie() {
  const signed = 's:' + cookieSignature.sign(JSON.stringify({ id: 'staff1', role: 'FITTING_STAFF' }), secret);
  return 'crwn_auth=' + encodeURIComponent(signed);
}

async function changeStatus(server, status) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ status });
    const req = http.request({ host: '127.0.0.1', port: server.address().port,
      method: 'PATCH', path: '/api/fitting-orders/order1', headers: {
        Cookie: staffCookie(), 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
      } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('pending order cannot skip preparing and complete directly', async () => {
  const updates = [];
  setMockHandler(async (operation, sql, params) => {
    if (operation === 'get' && sql.includes('SELECT FTR_Number FROM FITTING_ROOM')) return { FTR_Number: '1' };
    if (operation === 'get' && sql.includes('FROM FITTING_ROOM_SLOT')) return { FTR_ActiveSessionID: 'session1' };
    if (operation === 'get' && sql.includes('FROM FITTING_ROOM_SESSION')) return {
      FTR_SessionID: 'session1', FTR_RoomNumber: '1', CUS_ID: 'customer1', FTR_EndedAt: null, expired: 0
    };
    if (operation === 'get' && sql.includes('EMP_ID, FTR_FinishTime')) return {
      EMP_ID: null, FTR_FinishTime: null, FTR_CancelledAt: null, FTR_SessionID: 'session1'
    };
    if (operation === 'get' && sql.includes('SELECT FTR_FinishTime')) return { FTR_FinishTime: '2026-10-15T00:00:00Z' };
    if (operation === 'run') { updates.push({ sql, params }); return { changes: 1 }; }
    throw new Error(`Unexpected mock query: ${operation} ${sql}`);
  });
  const server = app.listen(0);
  try {
    const response = await changeStatus(server, 'complete');
    assert.equal(response.status, 409);
    assert.equal(updates.length, 0, 'rejected transition must not mutate the order');
  } finally {
    await new Promise(resolve => server.close(resolve));
    setMockHandler(null);
  }
});

async function scenario(initial, target, expectedStatus, expectedUpdate) {
  const updates = [];
  const order = { EMP_ID: null, FTR_FinishTime: null, FTR_CancelledAt: null,
    FTR_SessionID: 'session1', ...initial };
  setMockHandler(async (operation, sql, params) => {
    if (operation === 'get' && sql.includes('SELECT FTR_Number FROM FITTING_ROOM')) return { FTR_Number: '1' };
    if (operation === 'get' && sql.includes('FROM FITTING_ROOM_SLOT')) return { FTR_ActiveSessionID: 'session1' };
    if (operation === 'get' && sql.includes('FROM FITTING_ROOM_SESSION')) return {
      FTR_SessionID: 'session1', FTR_RoomNumber: '1', CUS_ID: 'customer1', FTR_EndedAt: null, expired: 0
    };
    if (operation === 'get' && sql.includes('EMP_ID, FTR_FinishTime')) return order;
    if (operation === 'get' && sql.includes('SELECT FTR_FinishTime')) return { FTR_FinishTime: order.FTR_FinishTime };
    if (operation === 'run' && sql.includes('UPDATE FITTING_ROOM SET EMP_ID = ?') &&
      sql.includes('AND EMP_ID IS NULL AND FTR_FinishTime IS NULL')) {
      updates.push(sql);
      if (order.EMP_ID != null || order.FTR_FinishTime != null) return { changes: 0 };
      order.EMP_ID = params[0]; return { changes: 1 };
    }
    if (operation === 'run' && sql.includes('UPDATE FITTING_ROOM SET FTR_FinishTime = NOW()') &&
      sql.includes('AND EMP_ID = ? AND FTR_FinishTime IS NULL')) {
      updates.push(sql);
      if (order.EMP_ID !== params[2] || order.FTR_FinishTime != null) return { changes: 0 };
      order.FTR_FinishTime = '2026-10-15T00:00:00Z'; return { changes: 1 };
    }
    throw new Error(`Unexpected mock query: ${operation} ${sql}`);
  });
  const server = app.listen(0);
  try {
    const response = await changeStatus(server, target);
    assert.equal(response.status, expectedStatus);
    assert.equal(updates.length, expectedUpdate);
    return { order, response };
  } finally {
    await new Promise(resolve => server.close(resolve));
    setMockHandler(null);
  }
}

test('pending→preparing claims order without finish time', async () => {
  const { order } = await scenario({}, 'preparing', 200, 1);
  assert.equal(order.EMP_ID, 'staff1');
  assert.equal(order.FTR_FinishTime, null);
});

test('preparing→complete finishes only owner claim', async () => {
  const { order } = await scenario({ EMP_ID: 'staff1' }, 'complete', 200, 1);
  assert.equal(order.FTR_FinishTime, '2026-10-15T00:00:00Z');
});

test('complete→complete returns idempotently without UPDATE', async () => {
  const { order } = await scenario({ EMP_ID: 'staff1', FTR_FinishTime: '2026-10-14T00:00:00Z' }, 'complete', 200, 0);
  assert.equal(order.FTR_FinishTime, '2026-10-14T00:00:00Z');
});

test('preparing→pending rollback is rejected without UPDATE', async () => {
  await scenario({ EMP_ID: 'staff1' }, 'pending', 409, 0);
});

test('preparing claimed by other staff cannot be completed', async () => {
  await scenario({ EMP_ID: 'staff2' }, 'complete', 409, 0);
});

test('order from previous session cannot be completed', async () => {
  await scenario({ EMP_ID: 'staff1', FTR_SessionID: 'old-session' }, 'complete', 409, 0);
});
