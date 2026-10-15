// ==========================================================
// Fitting orders belong to the customer's current visit
// (same CUS_ID + same room + FTR_OrderTime >= occupancy.since, floored to the second).
// Covers spec acceptance criteria 1-12 and 20 with a mock DB and in-memory occupancy.
// ==========================================================

process.env.USE_MOCK_DB = 'true';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test_secret_32_characters_minimum_length_abcdef';

const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

const { setMockHandler } = require('../database/db');
const { roomOccupancy } = require('../utils/roomOccupancy');
const apiRoutes = require('../routes/api');
const { isOrderInVisit } = require('../services/fittingOrders');

const SECRET = process.env.COOKIE_SECRET;
const SKU = '8850010110001';
const INSERT_SQL = 'INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, CUS_ID, FTR_OrderTime) VALUES (?, ?, NULL, ?, ?, ?)';

const app = express();
app.use(express.json());
app.use(cookieParser(SECRET));
app.use('/api', apiRoutes);

function cookieFor(user) {
  return 'crwn_auth=' + encodeURIComponent('s:' + cookieSignature.sign(JSON.stringify(user), SECRET));
}
const cus = id => cookieFor({ id, name: id, role: 'CUSTOMER' });
const staff = (id = 'staff1') => cookieFor({ id, name: id, role: 'FITTING_STAFF' });

let server;
function call(method, path, cookie, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const headers = { Cookie: cookie };
    if (payload) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(payload); }
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path, headers }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => {
        let parsed = text;
        try { parsed = JSON.parse(text); } catch (e) { /* keep text */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ---- mock DB -------------------------------------------------
let rows;      // FITTING_ROOM rows
let sqlLog;    // every SQL string seen, with params

const CATALOG = {
  [SKU]: { ITV_SKUID: SKU, ITV_Stock: 10, ITV_Color: 'Black', ITV_Size: 'M', ITM_Name: 'Oversized Cotton Tee', ITM_Price: 790, ITM_Tag: 'shirt', ITM_ID: 'p1' }
};

function oldRow(over) {
  return {
    FTR_OrderID: 'fo_old', ITV_SKUID: SKU, EMP_ID: null, FTR_Number: '3', CUS_ID: 'cus_old',
    FTR_OrderTime: new Date(Date.now() - 3600_000), FTR_FinishTime: null, ...over
  };
}

function handler(op, sql, params = []) {
  const q = sql.replace(/\s+/g, ' ').trim();
  sqlLog.push({ op, q, params });
  if (q === INSERT_SQL) {
    const [id, sku, room, cusId, time] = params;
    rows.push({ FTR_OrderID: id, ITV_SKUID: sku, EMP_ID: null, FTR_Number: room, CUS_ID: cusId, FTR_OrderTime: time, FTR_FinishTime: null });
    return { changes: 1 };
  }
  if (q.includes('FROM ITEM_VARIANT v') && q.includes('WHERE v.ITV_SKUID = ?')) return CATALOG[params[0]] || null;
  if (q.startsWith('SELECT FTR_OrderID, CUS_ID, FTR_Number')) {
    const r = rows.find(x => x.FTR_OrderID === params[0]);
    return r ? { ...r } : null;
  }
  if (q.startsWith('UPDATE FITTING_ROOM SET EMP_ID = ?')) {
    const r = rows.find(x => x.FTR_OrderID === params[1]);
    if (!r || r.EMP_ID != null || r.FTR_FinishTime) return { changes: 0 };
    r.EMP_ID = params[0];
    return { changes: 1 };
  }
  if (q.startsWith('UPDATE FITTING_ROOM SET FTR_FinishTime = ?')) {
    const r = rows.find(x => x.FTR_OrderID === params[1]);
    if (!r || String(r.EMP_ID) !== String(params[2]) || r.FTR_FinishTime) return { changes: 0 };
    r.FTR_FinishTime = params[0];
    return { changes: 1 };
  }
  if (q.includes('FROM FITTING_ROOM f')) {
    // Deliberately returns EVERY row (worst case coarse SQL filter): the JS visit filter must decide.
    // Ordered like the real query: pending, preparing, complete (newest first within a group).
    const rank = r => (r.FTR_FinishTime ? 3 : r.EMP_ID != null ? 2 : 1);
    const key = r => new Date(r.FTR_FinishTime || r.FTR_OrderTime).getTime();
    return rows.filter(r => r.ITV_SKUID)
      .sort((a, b) => rank(a) - rank(b) || key(b) - key(a))
      .map(r => ({
        id: r.FTR_OrderID,
        status: r.FTR_FinishTime ? 'complete' : (r.EMP_ID != null ? 'preparing' : 'pending'),
        createdAt: r.FTR_OrderTime, finishedAt: r.FTR_FinishTime, roomId: r.FTR_Number, sku: r.ITV_SKUID,
        empId: r.EMP_ID, size: 'M', color: 'Black', productName: 'Oversized Cotton Tee', price: 790,
        tag: 'shirt', productId: 'p1', staffName: null, cusId: r.CUS_ID
      }));
  }
  throw new Error(`Unexpected SQL: ${op} ${q}`);
}

const listQueries = () => sqlLog.filter(c => c.q.includes('FROM FITTING_ROOM f'));
const inserts = () => sqlLog.filter(c => c.q.startsWith('INSERT INTO FITTING_ROOM'));

const enter = (cookie, room) => call('POST', `/api/fitting-rooms/${room}/enter`, cookie, {});
const order = (cookie, room, sku = SKU) => call('POST', '/api/fitting-orders', cookie, { roomId: room, sku });
const staffList = (query = '?limit=5&myOnly=true', cookie = staff()) => call('GET', `/api/fitting-orders${query}`, cookie);
const sleep = ms => new Promise(r => setTimeout(r, ms));

beforeEach(async () => {
  roomOccupancy.clear();
  rows = [];
  sqlLog = [];
  setMockHandler(handler);
  if (!server) {
    server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
  }
});
after(async () => {
  roomOccupancy.clear();
  setMockHandler(null);
  if (server) await new Promise(resolve => server.close(resolve));
});

describe('kanban bug: stale rows of a room must not appear for a new customer', () => {
  test('AC1 old unfinished rows in room 3 (other customer and the same id) stay hidden after cus_B enters', async () => {
    rows.push(oldRow({ FTR_OrderID: 'fo_old_a', CUS_ID: 'cus_old' }));
    rows.push(oldRow({ FTR_OrderID: 'fo_old_b', CUS_ID: 'cus_B' }));
    const e = await enter(cus('cus_B'), '3');
    assert.equal(e.status, 200);
    const res = await staffList();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
  });

  test('AC2 after AC1, cus_B orders and staff sees exactly that one order', async () => {
    rows.push(oldRow({ FTR_OrderID: 'fo_old_a', CUS_ID: 'cus_old' }));
    rows.push(oldRow({ FTR_OrderID: 'fo_old_b', CUS_ID: 'cus_B' }));
    await enter(cus('cus_B'), '3');
    const created = await order(cus('cus_B'), '3');
    assert.equal(created.status, 200);
    const res = await staffList();
    assert.equal(res.status, 200);
    assert.equal(res.body.length, 1);
    const o = res.body[0];
    assert.equal(o.id, created.body.id);
    assert.equal(o.roomId, '3');
    assert.equal(o.roomDisplay, '3');
    assert.equal(o.status, 'pending');
    assert.equal('cusId' in o, false);
  });

  test('AC3 orders of cus_A (pending, preparing, complete) are invisible once cus_C holds room 1', async () => {
    await enter(cus('cus_A'), '1');
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await order(cus('cus_A'), '1')).body.id);
    // sanity: visible while A is inside
    assert.equal((await staffList('')).body.length, 3);
    rows.find(r => r.FTR_OrderID === ids[1]).EMP_ID = 'staff1';
    const done = rows.find(r => r.FTR_OrderID === ids[2]);
    done.EMP_ID = 'staff1';
    done.FTR_FinishTime = new Date();

    const sid = roomOccupancy.get('1').sessionId;
    const rel = await call('POST', '/api/fitting-rooms/1/release', cus('cus_A'), { sessionId: sid });
    assert.equal(rel.status, 200);
    assert.equal((await enter(cus('cus_C'), '1')).status, 200);

    const res = await staffList('');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
    const res2 = await staffList('?limit=5&myOnly=true');
    assert.deepEqual(res2.body, []);
  });

  test('AC4 the same customer re-entering sees only the new visit (customer view)', async () => {
    const cookie = cus('cus_A');
    await enter(cookie, '1');
    const first = await order(cookie, '1');
    assert.equal(first.status, 200);
    assert.equal((await call('GET', '/api/fitting-orders?roomId=1', cookie)).body.length, 1);
    const sid = roomOccupancy.get('1').sessionId;
    assert.equal((await call('POST', '/api/fitting-rooms/1/release', cookie, { sessionId: sid })).status, 200);
    // Visit start is floored to the second; wait for the clock second to advance so the previous
    // visit's order is strictly older (a human cannot exit and re-enter within one second).
    await sleep(1100);
    assert.equal((await enter(cookie, '1')).status, 200);

    const empty = await call('GET', '/api/fitting-orders?roomId=1', cookie);
    assert.equal(empty.status, 200);
    assert.deepEqual(empty.body, []);

    const second = await order(cookie, '1');
    assert.equal(second.status, 200);
    const after2 = await call('GET', '/api/fitting-orders?roomId=1', cookie);
    assert.equal(after2.body.length, 1);
    assert.equal(after2.body[0].id, second.body.id);
    assert.notEqual(second.body.id, first.body.id);
  });

  test('AC4b customer GET by barcode returns the same visit orders as by number', async () => {
    await enter(cus('cus_A'), '1');
    const o = await order(cus('cus_A'), '1');
    const byBarcode = await call('GET', '/api/fitting-orders?roomId=5684848452325', cus('cus_A'));
    assert.deepEqual(byBarcode.body.map(x => x.id), [o.body.id]);
  });

  test('AC4c a customer who does not hold the room gets [] even if rows exist', async () => {
    await enter(cus('cus_A'), '1');
    await order(cus('cus_A'), '1');
    const res = await call('GET', '/api/fitting-orders?roomId=1', cus('cus_other'));
    assert.deepEqual(res.body, []);
  });

  test('AC5 a row of the room holder in a room they do not hold is not shown to staff', async () => {
    await enter(cus('cus_A'), '1');
    rows.push(oldRow({ FTR_OrderID: 'fo_other_room', CUS_ID: 'cus_A', FTR_Number: '2', FTR_OrderTime: new Date(Date.now() + 5000) }));
    const res = await staffList('');
    assert.deepEqual(res.body, []);
  });

  test('AC6 nobody inside: staff gets [] and no FITTING_ROOM list SQL runs', async () => {
    rows.push(oldRow());
    const res = await staffList();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, []);
    assert.equal(listQueries().length, 0);
  });

  test('AC7 without myOnly staff sees other staff\'s preparing order; with myOnly the SQL filters by staffId', async () => {
    await enter(cus('cus_A'), '1');
    const o = await order(cus('cus_A'), '1');
    rows.find(r => r.FTR_OrderID === o.body.id).EMP_ID = 'staff2';

    const all = await staffList('', staff('staff1'));
    assert.equal(all.body.length, 1);
    assert.equal(all.body[0].status, 'preparing');
    assert.ok(!listQueries()[0].q.includes('(f.EMP_ID = ? OR f.EMP_ID IS NULL)'));

    sqlLog = [];
    await staffList('?myOnly=true', staff('staff1'));
    const q = listQueries()[0];
    assert.ok(q.q.includes('(f.EMP_ID = ? OR f.EMP_ID IS NULL)'));
    assert.ok(q.params.includes('staff1'));
  });

  test('AC8 limit=1 keeps one complete order but all pending and preparing', async () => {
    await enter(cus('cus_A'), '1');
    const ids = [];
    for (let i = 0; i < 4; i++) { await sleep(5); ids.push((await order(cus('cus_A'), '1')).body.id); }
    const byId = id => rows.find(r => r.FTR_OrderID === id);
    byId(ids[0]).EMP_ID = 's'; byId(ids[0]).FTR_FinishTime = new Date(Date.now() - 2000);
    byId(ids[1]).EMP_ID = 's'; byId(ids[1]).FTR_FinishTime = new Date(Date.now() - 1000);
    byId(ids[2]).EMP_ID = 's';
    const res = await staffList('?limit=1');
    const by = s => res.body.filter(o => o.status === s);
    assert.equal(by('complete').length, 1);
    assert.equal(by('complete')[0].id, ids[1], 'the most recently finished complete order is kept');
    assert.equal(by('preparing').length, 1);
    assert.equal(by('pending').length, 1);
    const none = await staffList('?limit=0');
    assert.equal(none.body.filter(o => o.status === 'complete').length, 2);
  });
});

describe('isOrderInVisit (unit)', () => {
  const since = new Date('2026-10-15T10:00:00.700Z').getTime();
  const occ = { cusId: 'c1', roomNumber: '1', since };
  const row = over => ({ cusId: 'c1', roomId: '1', createdAt: new Date('2026-10-15T10:00:00.000Z'), ...over });

  test('AC9 since is floored to the second: 10:00:00.000 is in the visit', () => {
    assert.equal(isOrderInVisit(row(), occ), true);
  });
  test('AC9 09:59:59 is before the visit', () => {
    assert.equal(isOrderInVisit(row({ createdAt: new Date('2026-10-15T09:59:59.000Z') }), occ), false);
  });
  test('AC9 different customer is not in the visit', () => {
    assert.equal(isOrderInVisit(row({ cusId: 'c2' }), occ), false);
  });
  test('AC9 null occupancy is false', () => {
    assert.equal(isOrderInVisit(row(), null), false);
  });
  test('AC9 unparseable createdAt is false', () => {
    assert.equal(isOrderInVisit(row({ createdAt: 'not a date' }), occ), false);
    assert.equal(isOrderInVisit(row({ createdAt: undefined }), occ), false);
  });
  test('AC9 room barcode compares equal to occupancy room number', () => {
    assert.equal(isOrderInVisit(row({ roomId: '5684848452325' }), occ), true);
  });
  test('AC9 a different room is false; unknown room is false', () => {
    assert.equal(isOrderInVisit(row({ roomId: '2' }), occ), false);
    assert.equal(isOrderInVisit(row({ roomId: '99' }), occ), false);
  });
});

describe('POST /api/fitting-orders', () => {
  test('AC10 inserts with the new SQL, whole-second Date, and createdAt equal to it', async () => {
    await enter(cus('u1'), '1');
    const res = await order(cus('u1'), '1');
    assert.equal(res.status, 200);
    assert.equal(inserts().length, 1);
    const ins = inserts()[0];
    assert.equal(ins.q, INSERT_SQL);
    assert.equal(ins.params[1], SKU);
    assert.equal(ins.params[2], '1');
    assert.equal(ins.params[3], 'u1');
    assert.ok(ins.params[4] instanceof Date);
    assert.equal(ins.params[4].getMilliseconds(), 0);
    assert.equal(res.body.createdAt, ins.params[4].toISOString());
    assert.equal(res.body.status, 'pending');
    assert.equal(res.body.roomId, '1');
  });

  test('AC10 ordering with the room barcode stores the canonical room number', async () => {
    await enter(cus('u1'), '1');
    const res = await order(cus('u1'), '5684848452325');
    assert.equal(res.status, 200);
    assert.equal(inserts()[0].params[2], '1');
  });

  test('AC11 empty room: 403 ROOM_NOT_HELD and no INSERT', async () => {
    const res = await order(cus('u1'), '1');
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ROOM_NOT_HELD');
    assert.equal(inserts().length, 0);
  });

  test('AC11 room held by someone else: 403 ROOM_NOT_HELD and no INSERT', async () => {
    await enter(cus('u2'), '1');
    const res = await order(cus('u1'), '1');
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ROOM_NOT_HELD');
    assert.equal(inserts().length, 0);
  });

  test('AC11 the TTL-expired holder no longer holds the room', async () => {
    await enter(cus('u1'), '1');
    // simulate expiry by clearing (TTL logic itself is covered in roomOccupancy.test.js)
    roomOccupancy.clear();
    const res = await order(cus('u1'), '1');
    assert.equal(res.status, 403);
    assert.equal(inserts().length, 0);
  });

  test('AC12 missing roomId: 400 INVALID_ROOM, no default to room 1', async () => {
    await enter(cus('u1'), '1');
    const res = await call('POST', '/api/fitting-orders', cus('u1'), { sku: SKU });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_ROOM');
    assert.equal(inserts().length, 0);
  });

  test('AC12 unknown roomId is also INVALID_ROOM; missing sku is INVALID_SKU', async () => {
    const bad = await order(cus('u1'), '99');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error.code, 'INVALID_ROOM');
    const noSku = await call('POST', '/api/fitting-orders', cus('u1'), { roomId: '1' });
    assert.equal(noSku.status, 400);
    assert.equal(noSku.body.error.code, 'INVALID_SKU');
  });

  test('a sessionId in the body is ignored (ownership comes from occupancy)', async () => {
    await enter(cus('u1'), '1');
    const res = await call('POST', '/api/fitting-orders', cus('u1'), { roomId: '1', sku: SKU, sessionId: 'bogus' });
    assert.equal(res.status, 200);
  });
});

describe('AC20 room release has no SQL and is owner-scoped', () => {
  test('u1 without body / wrong sessionId / right sessionId; empty room; other customer; staff force', async () => {
    setMockHandler(async () => { throw new Error('release must not run SQL'); });
    const e = await enter(cus('u1'), '1');
    const sid = e.body.sessionId;

    const noBody = await call('POST', '/api/fitting-rooms/1/release', cus('u1'));
    assert.equal(noBody.status, 403);
    assert.match(noBody.body.error, /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน/);
    assert.equal(roomOccupancy.get('1').cusId, 'u1');

    const wrong = await call('POST', '/api/fitting-rooms/1/release', cus('u1'), { sessionId: 'nope' });
    assert.equal(wrong.status, 403);
    assert.match(wrong.body.error, /รหัสเซสชันห้องลองไม่ตรงกับเซสชันปัจจุบัน/);

    const other = await call('POST', '/api/fitting-rooms/1/release', cus('u2'), { sessionId: sid });
    assert.equal(other.status, 403);
    assert.equal(roomOccupancy.get('1').cusId, 'u1');

    const forced = await call('POST', '/api/fitting-rooms/1/release', staff());
    assert.equal(forced.status, 200);
    assert.equal(roomOccupancy.get('1'), null);

    const empty = await call('POST', '/api/fitting-rooms/1/release', cus('u1'), { sessionId: sid });
    assert.equal(empty.status, 403);
    assert.match(empty.body.error, /no active fitting room session/);

    const e2 = await enter(cus('u1'), '1');
    const ok = await call('POST', '/api/fitting-rooms/1/release', cus('u1'), { sessionId: e2.body.sessionId });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.success, true);
    assert.equal(roomOccupancy.get('1'), null);
  });
});
