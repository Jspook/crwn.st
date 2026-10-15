const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { createRoomOccupancy, DEFAULT_TTL_MS } = require('../utils/roomOccupancy');

function make(ttlMs = 1000) {
  let t = 1_000_000;
  const occ = createRoomOccupancy({ ttlMs, now: () => t });
  return { occ, advance: ms => { t += ms; } };
}

describe('utils/roomOccupancy — in-memory room lock', () => {
  test('default TTL is 45 minutes', () => {
    assert.equal(DEFAULT_TTL_MS, 45 * 60 * 1000);
  });

  test('acquire on an empty room succeeds and returns a session id', () => {
    const { occ } = make();
    const r = occ.acquire('1', 'cus_1');
    assert.equal(r.ok, true);
    assert.equal(r.resumed, false);
    assert.match(r.sessionId, /^ses_/);
    assert.equal(occ.get('1').cusId, 'cus_1');
  });

  test('same owner re-acquire resumes the same session', () => {
    const { occ } = make();
    const a = occ.acquire('1', 'cus_1');
    const b = occ.acquire('1', 'cus_1');
    assert.equal(b.ok, true);
    assert.equal(b.resumed, true);
    assert.equal(b.sessionId, a.sessionId);
  });

  test('different customer is rejected as OCCUPIED and owner is unchanged', () => {
    const { occ } = make();
    occ.acquire('1', 'cus_1');
    const r = occ.acquire('1', 'cus_2');
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'OCCUPIED');
    assert.equal(occ.get('1').cusId, 'cus_1');
  });

  test('cusId compares as string (1 and "1" are the same owner)', () => {
    const { occ } = make();
    occ.acquire('1', 1);
    assert.equal(occ.acquire('1', '1').resumed, true);
  });

  test('release with correct owner + session frees the room', () => {
    const { occ } = make();
    const { sessionId } = occ.acquire('2', 'cus_1');
    assert.deepEqual(occ.release('2', { cusId: 'cus_1', sessionId }), { ok: true });
    assert.equal(occ.get('2'), null);
  });

  test('release without sessionId by the owner is rejected with SESSION_MISMATCH and keeps the lock', () => {
    const { occ } = make();
    occ.acquire('2', 'cus_1');
    const r = occ.release('2', { cusId: 'cus_1' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'SESSION_MISMATCH');
    assert.equal(occ.get('2').cusId, 'cus_1');
  });

  test('release with wrong session is rejected with SESSION_MISMATCH', () => {
    const { occ } = make();
    occ.acquire('2', 'cus_1');
    const r = occ.release('2', { cusId: 'cus_1', sessionId: 'ses_wrong' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'SESSION_MISMATCH');
    assert.ok(occ.get('2'));
  });

  test('release by another customer is rejected with NOT_ACTIVE and keeps the lock', () => {
    const { occ } = make();
    occ.acquire('2', 'cus_1');
    const r = occ.release('2', { cusId: 'cus_2' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'NOT_ACTIVE');
    assert.equal(occ.get('2').cusId, 'cus_1');
  });

  test('release twice: second call is NOT_ACTIVE', () => {
    const { occ } = make();
    const { sessionId } = occ.acquire('3', 'cus_1');
    occ.release('3', { cusId: 'cus_1', sessionId });
    const r = occ.release('3', { cusId: 'cus_1', sessionId });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'NOT_ACTIVE');
  });

  test('staff force release frees any room and is idempotent on empty rooms', () => {
    const { occ } = make();
    occ.acquire('3', 'cus_1');
    assert.equal(occ.release('3', { force: true }).ok, true);
    assert.equal(occ.get('3'), null);
    assert.equal(occ.release('3', { force: true }).ok, true);
  });

  test('rooms are independent', () => {
    const { occ } = make();
    occ.acquire('1', 'cus_1');
    assert.equal(occ.acquire('10', 'cus_2').ok, true);
    occ.release('1', { cusId: 'cus_1' });
    assert.equal(occ.get('10').cusId, 'cus_2');
  });

  test('TTL: idle room expires, then another customer can acquire', () => {
    const { occ, advance } = make(1000);
    occ.acquire('4', 'cus_1');
    advance(1001);
    assert.equal(occ.get('4'), null);
    const r = occ.acquire('4', 'cus_2');
    assert.equal(r.ok, true);
    assert.equal(r.resumed, false);
  });

  test('TTL: touch extends the lock; boundary is exclusive of expiry', () => {
    const { occ, advance } = make(1000);
    const { sessionId } = occ.acquire('4', 'cus_1');
    advance(900);
    assert.equal(occ.touch('4', sessionId), true);
    advance(900);
    assert.ok(occ.get('4'));
  });

  test('touch with wrong session or empty room returns false', () => {
    const { occ } = make();
    occ.acquire('4', 'cus_1');
    assert.equal(occ.touch('4', 'ses_wrong'), false);
    assert.equal(occ.touch('5', 'ses_x'), false);
  });

  test('expire() sweep removes only stale rooms', () => {
    const { occ, advance } = make(1000);
    occ.acquire('1', 'cus_1');
    advance(600);
    occ.acquire('2', 'cus_2');
    advance(600);
    assert.equal(occ.expire(), 1);
    assert.equal(occ.get('1'), null);
    assert.ok(occ.get('2'));
  });

  test('list() and getByCustomer() reflect live occupancy only', () => {
    const { occ, advance } = make(1000);
    occ.acquire('1', 'cus_1');
    occ.acquire('2', 'cus_2');
    assert.deepEqual(occ.list().map(e => e.roomNumber).sort(), ['1', '2']);
    assert.equal(occ.getByCustomer('cus_2').roomNumber, '2');
    advance(1001);
    assert.deepEqual(occ.list(), []);
    assert.equal(occ.getByCustomer('cus_2'), null);
  });

  test('race: two synchronous acquires on one room yield exactly one winner', () => {
    const { occ } = make();
    const results = ['cus_a', 'cus_b'].map(c => occ.acquire('7', c));
    assert.equal(results.filter(r => r.ok).length, 1);
    assert.equal(results.filter(r => !r.ok && r.reason === 'OCCUPIED').length, 1);
  });

  test('get() returns a copy so callers cannot mutate the lock', () => {
    const { occ } = make();
    occ.acquire('1', 'cus_1');
    occ.get('1').cusId = 'hacker';
    assert.equal(occ.get('1').cusId, 'cus_1');
  });

  test('clear() empties all rooms (test helper)', () => {
    const { occ } = make();
    occ.acquire('1', 'cus_1');
    occ.clear();
    assert.deepEqual(occ.list(), []);
  });
});
