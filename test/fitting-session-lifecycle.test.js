const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
process.env.USE_MOCK_DB = 'true';
const { setMockHandler } = require('../database/db');
const sessions = require('../utils/fittingSessions');

afterEach(() => setMockHandler(null));

function fakeStore() {
  const slots = new Map();
  const history = new Map();
  const orders = new Map();
  let failCancel = false;
  setMockHandler(async (op, sql, p = []) => {
    const q = sql.replace(/\s+/g, ' ').trim();
    if (q.startsWith('INSERT IGNORE INTO FITTING_ROOM_SLOT')) {
      if (!slots.has(p[0])) slots.set(p[0], null);
      return { changes: 1 };
    }
    if (q.includes('FROM FITTING_ROOM_SLOT') && q.includes('FOR UPDATE')) {
      const id = slots.get(p[0]);
      return id ? { FTR_ActiveSessionID: id } : { FTR_ActiveSessionID: null };
    }
    if (q.includes('FROM FITTING_ROOM_SESSION') && q.includes('FTR_SessionID = ?')) {
      return history.get(p[0]) || null;
    }
    if (q.startsWith('INSERT INTO FITTING_ROOM_SESSION')) {
      history.set(p[0], { FTR_SessionID: p[0], FTR_RoomNumber: p[1], CUS_ID: p[2], FTR_EndedAt: null, expired: false });
      return { changes: 1 };
    }
    if (q.startsWith('UPDATE FITTING_ROOM_SLOT')) {
      // clear-active: UPDATE ... SET FTR_ActiveSessionID = NULL WHERE FTR_RoomNumber = ? AND FTR_ActiveSessionID = ?
      // params = [roomNumber, expectedSessionId]; only clears when the room still holds that exact session.
      if (/SET FTR_ActiveSessionID = NULL\b/.test(q)) {
        const [room, expect] = p;
        if (slots.get(room) === expect) { slots.set(room, null); return { changes: 1 }; }
        return { changes: 0 };
      }
      // set-active: UPDATE ... SET FTR_ActiveSessionID = ? WHERE FTR_RoomNumber = ? AND FTR_ActiveSessionID IS NULL
      // params = [sessionId, roomNumber]; only sets when the slot is currently empty.
      if (/SET FTR_ActiveSessionID = \?/.test(q) && /FTR_ActiveSessionID IS NULL/.test(q)) {
        const [sessionId, room] = p;
        if (slots.get(room) == null) { slots.set(room, sessionId); return { changes: 1 }; }
        return { changes: 0 };
      }
      throw new Error(`Unexpected FITTING_ROOM_SLOT UPDATE: ${q}`);
    }
    if (q.startsWith('UPDATE FITTING_ROOM_SESSION SET FTR_LastSeenAt')) return { changes: 1 };
    if (q.startsWith('UPDATE FITTING_ROOM_SESSION SET FTR_EndedAt')) {
      history.get(p[1]).FTR_EndedAt = new Date(); return { changes: 1 };
    }
    if (q.startsWith('UPDATE FITTING_ROOM SET FTR_CancelledAt')) {
      if (failCancel) throw new Error('mock cancellation failure');
      for (const o of orders.values()) if (o.session === p[0] && o.status === 'pending') o.cancelled = true;
      return { changes: 1 };
    }
    if (q.includes('FROM FITTING_ROOM_SLOT slot') && q.includes('JOIN FITTING_ROOM_SESSION')) {
      if (op === 'query') return [...slots].filter(([,id]) => id && !history.get(id).FTR_EndedAt).map(([room,id]) => ({ FTR_RoomNumber: room, FTR_SessionID: id, CUS_ID: history.get(id).CUS_ID }));
      const id = slots.get(p[0]); const s = history.get(id);
      return s && !s.FTR_EndedAt && !s.expired ? { ...s } : null;
    }
    throw new Error(`Unexpected SQL: ${op} ${q}`);
  });
  return { slots, history, orders, setFailCancel: v => { failCancel = v; } };
}

test('S1 release retains preparing history, cancels pending, S2 cannot inherit S1', async () => {
  const db = fakeStore();
  const s1 = await sessions.acquire('1', 'customer1');
  assert.equal((await sessions.acquire('1', 'customer1')).sessionId, s1.sessionId);
  assert.equal((await sessions.acquire('1', 'customer2')).reason, 'OCCUPIED');
  db.orders.set('p', { session: s1.sessionId, status: 'pending', cancelled: false });
  db.orders.set('a', { session: s1.sessionId, status: 'preparing', cancelled: false });
  assert.equal((await sessions.release('1', { cusId: 'customer1', sessionId: s1.sessionId })).ok, true);
  assert.equal(db.orders.get('p').cancelled, true);
  assert.equal(db.orders.get('a').cancelled, false);
  assert.equal(db.slots.get('1'), null); // release must clear the room slot, not leave it pinned
  const s2 = await sessions.acquire('1', 'customer2');
  assert.notEqual(s2.sessionId, s1.sessionId);
  assert.equal((await sessions.release('1', { cusId: 'customer1', sessionId: s1.sessionId })).ok, false);
  assert.equal(db.slots.get('1'), s2.sessionId);
  assert.equal((await sessions.getActive('1')).FTR_SessionID, s2.sessionId);
});

test('release without explicit matching customer session fails closed', async () => {
  const db = fakeStore();
  const s = await sessions.acquire('1', 'customer1');
  assert.equal((await sessions.release('1', { cusId: 'customer1' })).ok, false);
  assert.equal((await sessions.release('1', { cusId: 'customer2', sessionId: s.sessionId })).ok, false);
  assert.equal(db.slots.get('1'), s.sessionId);
});

test('database cancellation failure cannot be reported as successful release', async () => {
  const db = fakeStore();
  const s = await sessions.acquire('1', 'customer1');
  db.setFailCancel(true);
  await assert.rejects(() => sessions.release('1', { cusId: 'customer1', sessionId: s.sessionId }), /mock cancellation failure/);
});

test('E2: release on an expired session reaps it (cancels pending, ends session, clears slot) and reports NOT_ACTIVE', async () => {
  const db = fakeStore();
  const s = await sessions.acquire('1', 'customer1');
  db.orders.set('p', { session: s.sessionId, status: 'pending', cancelled: false });
  db.orders.set('a', { session: s.sessionId, status: 'preparing', cancelled: false });
  db.history.get(s.sessionId).expired = true;
  const result = await sessions.release('1', { cusId: 'customer1', sessionId: s.sessionId });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'NOT_ACTIVE');
  assert.equal(db.orders.get('p').cancelled, true, 'pending of the expired session is cancelled');
  assert.equal(db.orders.get('a').cancelled, false, 'preparing stays as history');
  assert.ok(db.history.get(s.sessionId).FTR_EndedAt, 'expired session is ended');
  assert.equal(db.slots.get('1'), null, 'slot is no longer pinned to the expired session');
});

test('E2: withLockedActive on an expired session reaps it without running the work callback', async () => {
  const db = fakeStore();
  const s = await sessions.acquire('1', 'customer1');
  db.orders.set('p', { session: s.sessionId, status: 'pending', cancelled: false });
  db.history.get(s.sessionId).expired = true;
  let ran = false;
  const result = await sessions.withLockedActive('1', {}, async () => { ran = true; });
  assert.equal(result.ok, false);
  assert.equal(ran, false);
  assert.equal(db.orders.get('p').cancelled, true);
  assert.equal(db.slots.get('1'), null);
});

test('E2: a live (non-expired) session is never reaped by withLockedActive', async () => {
  const db = fakeStore();
  const s = await sessions.acquire('1', 'customer1');
  db.orders.set('p', { session: s.sessionId, status: 'pending', cancelled: false });
  const result = await sessions.withLockedActive('1', { cusId: 'customer1' }, async (tx, active) => active.FTR_SessionID);
  assert.equal(result.ok, true);
  assert.equal(result.value, s.sessionId);
  assert.equal(db.orders.get('p').cancelled, false);
  assert.equal(db.slots.get('1'), s.sessionId);
});
