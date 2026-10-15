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

// Durable-session mock: the route now serializes on FITTING_ROOM_SLOT and reads FITTING_ROOM_SESSION.
function mockSessionStore({ sessionId = 'ses_current', cusId = 'u1', expired = false } = {}) {
  const slots = new Map([['1', sessionId]]);
  const sessions = new Map([[sessionId, {
    FTR_SessionID: sessionId, FTR_RoomNumber: '1', CUS_ID: cusId, FTR_EndedAt: null, expired
  }]]);
  const cancelledSessions = [];
  setMockHandler(async (op, sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.includes('FROM FITTING_ROOM_SLOT') && q.includes('FOR UPDATE')) {
      const id = slots.get(params[0]);
      return { FTR_ActiveSessionID: id === undefined ? null : id };
    }
    if (q.includes('FROM FITTING_ROOM_SESSION') && q.includes('FTR_SessionID = ?')) {
      return sessions.get(params[0]) || null;
    }
    if (q.startsWith('UPDATE FITTING_ROOM SET FTR_CancelledAt')) {
      cancelledSessions.push(params[0]);
      return { changes: 0 };
    }
    if (q.startsWith('UPDATE FITTING_ROOM_SESSION SET FTR_EndedAt')) {
      sessions.get(params[1]).FTR_EndedAt = new Date();
      return { changes: 1 };
    }
    if (q.startsWith('UPDATE FITTING_ROOM_SLOT SET FTR_ActiveSessionID = NULL')) {
      if (slots.get(params[0]) === params[1]) { slots.delete(params[0]); return { changes: 1 }; }
      return { changes: 0 };
    }
    throw new Error(`Unexpected SQL: ${op} ${q}`);
  });
  return { slots, sessions, cancelledSessions };
}

// CONTRACT CHANGE (approved policy): a customer release must name its session, so an empty body is
// no longer accepted. The pre-refactor suite asserted 200 here; that expectation is deliberately gone.
test('release without a sessionId is rejected with 403 and keeps the session intact', async () => {
  const store = mockSessionStore();
  await withServer(async server => {
    const response = await request(server, '5684848452325');
    assert.equal(response.status, 403);
    assert.match(response.body.error, /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน/);
  });
  assert.equal(store.slots.get('1'), 'ses_current');
  assert.equal(store.sessions.get('ses_current').FTR_EndedAt, null);
  assert.deepEqual(store.cancelledSessions, []);
});

test('release with the matching session clears the slot and reports success', async () => {
  const store = mockSessionStore();
  await withServer(async server => {
    const response = await request(server, '5684848452325', { sessionId: 'ses_current' });
    assert.equal(response.status, 200);
    assert.equal(response.body.success, true);
  });
  assert.equal(store.slots.has('1'), false);
  assert.ok(store.sessions.get('ses_current').FTR_EndedAt);
});

test('release of an unknown session returns a 403 error the client can display', async () => {
  const store = mockSessionStore();
  await withServer(async server => {
    const response = await request(server, '5684848452325', { sessionId: 'ses_unknown' });
    assert.equal(response.status, 403);
    assert.match(response.body.error, /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน/);
  });
  assert.equal(store.slots.get('1'), 'ses_current');
});

test('release on an empty room returns 403 without touching any session', async () => {
  setMockHandler(async (op, sql, params = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.includes('FROM FITTING_ROOM_SLOT') && q.includes('FOR UPDATE')) return { FTR_ActiveSessionID: null };
    throw new Error(`Unexpected SQL: ${op} ${q}`);
  });
  await withServer(async server => {
    const response = await request(server, '5684848452325', { sessionId: 'ses_current' });
    assert.equal(response.status, 403);
    assert.match(response.body.error, /no active fitting room session/);
  });
});

