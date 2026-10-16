// PATCH /api/fitting-orders/:id state machine (spec step 5.6, rows a-i).
// Occupancy is in memory; the mock DB only knows the FITTING_ROOM row.
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
const secret = 'mock_only_secret_for_transition_tests';
const app = express();
app.use(express.json());
app.use(cookieParser(secret));
app.use('/api', apiRoutes);

beforeEach(() => { roomOccupancy.clear(); setMockHandler(null); });
after(() => { roomOccupancy.clear(); setMockHandler(null); });

function staffCookie(id = 'staff1') {
  const signed = 's:' + cookieSignature.sign(JSON.stringify({ id, role: 'FITTING_STAFF' }), secret);
  return 'crwn_auth=' + encodeURIComponent(signed);
}

function patch(server, id, status, cookie = staffCookie()) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ status });
    const req = http.request({ host: '127.0.0.1', port: server.address().port,
      method: 'PATCH', path: `/api/fitting-orders/${id}`, headers: {
        Cookie: cookie, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body)
      } }, res => {
      let text = '';
      res.on('data', chunk => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

// Runs one PATCH against a mock row. `row` overrides defaults (customer cus1 in room 1, now, pending).
// `hold` = [roomNumber, cusId] to put in occupancy before the call (null for nobody).
async function scenario(rowOverrides, target, { hold = ['1', 'cus1'], staffId = 'staff1', claimChanges = 1 } = {}) {
  if (hold) roomOccupancy.acquire(hold[0], hold[1]);
  const row = {
    FTR_OrderID: 'order1', CUS_ID: 'cus1', FTR_Number: '1', FTR_OrderTime: new Date(),
    EMP_ID: null, FTR_FinishTime: null, ...rowOverrides
  };
  const updates = [];
  setMockHandler(async (op, sql, params) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (op === 'get' && q.startsWith('SELECT FTR_OrderID, CUS_ID, FTR_Number, FTR_OrderTime, EMP_ID, FTR_FinishTime FROM FITTING_ROOM WHERE FTR_OrderID = ?')) {
      return params[0] === 'order1' ? { ...row } : null;
    }
    if (op === 'run' && q.startsWith('UPDATE FITTING_ROOM')) {
      updates.push({ q, params });
      return { changes: claimChanges };
    }
    throw new Error(`Unexpected mock query: ${op} ${q}`);
  });
  const server = app.listen(0);
  try {
    const response = await patch(server, 'order1', target, staffCookie(staffId));
    return { response, updates };
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('AC13 pending -> complete is 409 INVALID_TRANSITION without UPDATE', async () => {
  const { response, updates } = await scenario({}, 'complete');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'INVALID_TRANSITION');
  assert.equal(updates.length, 0);
});

test('AC14 pending -> preparing claims with [staffId, id] and returns finishedAt null', async () => {
  const { response, updates } = await scenario({}, 'preparing');
  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.status, 'preparing');
  assert.equal(response.body.finishedAt, null);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0].params, ['staff1', 'order1']);
});

test('AC14 claim losing the race (changes 0) is 409 STALE_ORDER', async () => {
  const { response } = await scenario({}, 'preparing', { claimChanges: 0 });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'STALE_ORDER');
});

test('AC15 preparing (same staff) -> complete is 200 with finishedAt set', async () => {
  const { response, updates } = await scenario({ EMP_ID: 'staff1' }, 'complete');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'complete');
  assert.ok(response.body.finishedAt);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].params[1], 'order1');
  assert.equal(updates[0].params[2], 'staff1');
});

test('AC15 complete -> complete is idempotent: 200, same finishedAt, no UPDATE', async () => {
  const finished = new Date('2026-10-14T10:00:00.000Z');
  const { response, updates } = await scenario({ EMP_ID: 'staff1', FTR_FinishTime: finished }, 'complete');
  assert.equal(response.status, 200);
  assert.equal(new Date(response.body.finishedAt).getTime(), finished.getTime());
  assert.equal(updates.length, 0);
});

test('AC16 preparing -> pending is 409 INVALID_TRANSITION without UPDATE', async () => {
  const { response, updates } = await scenario({ EMP_ID: 'staff1' }, 'pending');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'INVALID_TRANSITION');
  assert.equal(updates.length, 0);
});

test('AC16 complete -> preparing is 409 COMPLETE_IMMUTABLE without UPDATE', async () => {
  const { response, updates } = await scenario({ EMP_ID: 'staff1', FTR_FinishTime: new Date() }, 'preparing');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'COMPLETE_IMMUTABLE');
  assert.equal(updates.length, 0);
});

test('AC17 order preparing by staff2 cannot be completed by staff1 (NOT_OWNER, no UPDATE)', async () => {
  const { response, updates } = await scenario({ EMP_ID: 'staff2' }, 'complete');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'NOT_OWNER');
  assert.equal(updates.length, 0);
});

test('AC18 customer left the room -> preparing is 409 NOT_ACTIVE without UPDATE', async () => {
  const { response, updates } = await scenario({}, 'preparing', { hold: null });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'NOT_ACTIVE');
  assert.equal(updates.length, 0);
});

test('AC18 order older than the current occupant since is NOT_ACTIVE', async () => {
  const { response, updates } = await scenario({ FTR_OrderTime: new Date(Date.now() - 3600_000) }, 'preparing');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'NOT_ACTIVE');
  assert.equal(updates.length, 0);
});

test('AC18 order whose CUS_ID differs from the room holder is NOT_ACTIVE', async () => {
  const { response, updates } = await scenario({ CUS_ID: 'cus_other' }, 'preparing');
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'NOT_ACTIVE');
  assert.equal(updates.length, 0);
});

test('AC18 order whose room is held by someone else is NOT_ACTIVE (barcode FTR_Number also resolved)', async () => {
  const { response } = await scenario({ FTR_Number: '5684848452325', CUS_ID: 'cus1' }, 'preparing', { hold: ['1', 'cus_other'] });
  assert.equal(response.status, 409);
  assert.equal(response.body.error, 'NOT_ACTIVE');
});

test('AC18 order stored under the room barcode is still in the visit of room 1', async () => {
  const { response } = await scenario({ FTR_Number: '5684848452325' }, 'preparing');
  assert.equal(response.status, 200);
});

test('AC19 unknown status is 400 and unknown id is 404', async () => {
  roomOccupancy.acquire('1', 'cus1');
  setMockHandler(async (op, sql) => {
    if (op === 'get' && sql.includes('FROM FITTING_ROOM')) return null;
    throw new Error('unexpected');
  });
  const server = app.listen(0);
  try {
    assert.equal((await patch(server, 'order1', 'foo')).status, 400);
    assert.equal((await patch(server, 'missing', 'preparing')).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
