const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

// The DB module refuses a real connection in mock mode. Never run against live MySQL.
process.env.USE_MOCK_DB = 'true';
const secret = 'test_secret_32_characters_minimum_length_abcdef';
const { setMockHandler } = require('../database/db');
const apiRoutes = require('../routes/api');
const { roomOccupancy } = require('../utils/roomOccupancy');
const app = express();
app.use(express.json());
app.use(cookieParser(secret));
app.use('/api', apiRoutes);

after(() => setMockHandler(null));

function authCookie(id = 'u1') {
  const signed = 's:' + cookieSignature.sign(JSON.stringify({ id, name: 'Test', role: 'CUSTOMER' }), secret);
  return 'crwn_auth=' + encodeURIComponent(signed);
}

function request(server, roomId, body) {
  return new Promise((resolve, reject) => {
    const headers = { Cookie: authCookie() };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const req = http.request({ port: server.address().port, host: '127.0.0.1', path: `/api/fitting-rooms/${roomId}/release`, method: 'POST', headers }, (res) => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
}

async function withServer(fn) {
  const server = app.listen(0);
  try { return await fn(server); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

function loadReleaseFunction(fetchImpl, alertImpl = () => {}) {
  const source = fs.readFileSync(path.join(__dirname, '../views/customer/fitting-room.ejs'), 'utf8');
  const start = source.indexOf('  async function releaseCurrentRoom() {');
  const end = source.indexOf('\n  function renderExitItemsList(', start);
  assert.ok(start >= 0 && end > start, 'fitting-room release function is present');
  const context = {
    currentRoomId: '5684848452325',
    currentSessionId: 'ses_current',
    storageKey: 'crwn_active_session_5684848452325',
    localStorage: { removeItem: () => {} },
    alert: alertImpl,
    fetch: fetchImpl,
    console,
  };
  vm.runInNewContext(source.slice(start, end), context);
  return context.releaseCurrentRoom;
}

test('exit sends its active session ID as JSON and acknowledges success', async () => {
  let called;
  const release = loadReleaseFunction(async (url, options) => {
    called = { url, options };
    return { ok: true, json: async () => ({ success: true }) };
  });
  const result = await release();
  assert.equal(called.url, '/api/fitting-rooms/5684848452325/release');
  assert.equal(called.options.method, 'POST');
  assert.equal(called.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(called.options.body), { sessionId: 'ses_current' });
  assert.equal(result, true);
});

test('exit does not claim success when release API rejects', async () => {
  const release = loadReleaseFunction(async () => ({ ok: false, status: 500, json: async () => ({ error: 'release failed' }) }));
  const result = await release();
  assert.equal(result, false);
});

test('exit displays server error message when release API returns error in body', async () => {
  let alerted = null;
  const release = loadReleaseFunction(
    async () => ({ ok: false, status: 403, json: async () => ({ error: 'รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน' }) }),
    (msg) => { alerted = msg; }
  );
  const result = await release();
  assert.equal(result, false);
  assert.equal(alerted, 'รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน');
});

function loadExitFunctions(releaseImpl) {
  const source = fs.readFileSync(path.join(__dirname, '../views/customer/fitting-room.ejs'), 'utf8');
  const start = source.indexOf('  async function exitAndAddToCart(');
  const end = source.indexOf('</script>', start);
  assert.ok(start >= 0 && end > start);
  const buttons = {
    'btn-add-and-checkout': { disabled: false, style: {} },
    'btn-add-and-return': { disabled: false, style: {} }
  };
  const location = { href: '/customer/fitting-room' };
  let cleared = false;
  const context = {
    document: {
      querySelectorAll: () => [{ value: 'sku_one' }],
      getElementById: id => buttons[id] || { classList: { add() {} } }
    },
    validCompletedOrders: [{ sku: 'sku_one', productId: 'p1', productName: 'Tee', price: 100, color: 'Black', size: 'S' }],
    Cart: { addItem: async () => {}, syncBackend: async () => {}, showToast: () => {} },
    currentRoomId: '5684848452325',
    clearTriedFittingItems: () => { cleared = true; },
    releaseCurrentRoom: releaseImpl,
    closeExitModal: () => {},
    window: { location },
  };
  vm.runInNewContext(source.slice(start, end), context);
  return { context, buttons, location, wasCleared: () => cleared };
}

for (const checkout of [true, false]) {
  test(`cart exit ${checkout ? 'checkout' : 'continue shopping'} does not navigate if room release failed`, async () => {
    const state = loadExitFunctions(async () => false);
    await state.context.exitAndAddToCart(checkout);
    assert.equal(state.location.href, '/customer/fitting-room');
    assert.equal(state.wasCleared(), false);
    assert.equal(state.buttons['btn-add-and-checkout'].disabled, false);
    assert.equal(state.buttons['btn-add-and-return'].disabled, false);
  });
}

for (const checkout of [true, false]) {
  test(`cart exit ${checkout ? 'checkout' : 'continue shopping'} navigates after confirmed release`, async () => {
    const state = loadExitFunctions(async () => true);
    await state.context.exitAndAddToCart(checkout);
    assert.equal(state.location.href, checkout ? '/customer/checkout' : '/customer/dashboard');
    assert.equal(state.wasCleared(), true);
  });
}

test('exit without cart stays in room when release fails', async () => {
  const state = loadExitFunctions(async () => false);
  await state.context.exitWithoutCart();
  assert.equal(state.location.href, '/customer/fitting-room');
  assert.equal(state.wasCleared(), false);
});

test('cart exit can retry after a failed release and only then navigate', async () => {
  let attempts = 0;
  const state = loadExitFunctions(async () => ++attempts > 1);
  await state.context.exitAndAddToCart(true);
  assert.equal(state.location.href, '/customer/fitting-room');
  assert.equal(state.buttons['btn-add-and-checkout'].disabled, false);
  await state.context.exitAndAddToCart(true);
  assert.equal(state.location.href, '/customer/checkout');
  assert.equal(state.wasCleared(), true);
  assert.equal(attempts, 2);
});

test('release endpoint tolerates an empty POST body from an older client', async () => {
  roomOccupancy.clear();
  roomOccupancy.acquire('1', 'u1');
  setMockHandler(async (op, sql) => {
    throw new Error(`Release must not touch the DB: ${op} ${sql}`);
  });
  await withServer(async server => {
    const response = await request(server, '5684848452325');
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });
  assert.equal(roomOccupancy.get('1'), null);
});

test('release of an unknown session returns a 403 error the client can display', async () => {
  roomOccupancy.clear();
  roomOccupancy.acquire('1', 'u1');
  await withServer(async server => {
    const response = await request(server, '5684848452325', { sessionId: 'ses_unknown' });
    assert.equal(response.status, 403);
    assert.ok(response.body.error);
  });
  assert.ok(roomOccupancy.get('1'));
  roomOccupancy.clear();
});

