// ==========================================================
// crwn.st In-Memory Fitting Room Occupancy
// Who is inside which room lives in server memory only (no DB).
// Single Node process only. A restart frees every room.
// All operations are synchronous so check-and-set is atomic
// (never put an `await` between a check and its mutation).
// ==========================================================

const crypto = require('crypto');

const DEFAULT_TTL_MS = 45 * 60 * 1000;

/**
 * @param {{ ttlMs?: number, now?: () => number }} [options]
 */
function createRoomOccupancy({ ttlMs = DEFAULT_TTL_MS, now = Date.now } = {}) {
  /** @type {Map<string, { roomNumber: string, cusId: string, sessionId: string, since: number, lastSeen: number }>} */
  const rooms = new Map();

  const keyOf = roomNumber => String(roomNumber);

  function isStale(entry) {
    return now() - entry.lastSeen > ttlMs;
  }

  // Returns the live entry or drops it when stale.
  function live(roomNumber) {
    const key = keyOf(roomNumber);
    const entry = rooms.get(key);
    if (!entry) return null;
    if (isStale(entry)) {
      rooms.delete(key);
      return null;
    }
    return entry;
  }

  function acquire(roomNumber, cusId) {
    const key = keyOf(roomNumber);
    const owner = String(cusId);
    const existing = live(key);
    if (existing) {
      if (existing.cusId === owner) {
        existing.lastSeen = now();
        return { ok: true, sessionId: existing.sessionId, resumed: true };
      }
      return { ok: false, reason: 'OCCUPIED' };
    }
    // One active room per customer
    const other = getByCustomer(owner);
    if (other && other.roomNumber !== key) {
      return { ok: false, reason: 'CUSTOMER_IN_OTHER_ROOM', roomNumber: other.roomNumber };
    }
    const t = now();
    const sessionId = 'ses_' + crypto.randomUUID();
    rooms.set(key, { roomNumber: key, cusId: owner, sessionId, since: t, lastSeen: t });
    return { ok: true, sessionId, resumed: false };
  }

  function release(roomNumber, { cusId, sessionId, force = false } = {}) {
    const key = keyOf(roomNumber);
    const existing = live(key);
    if (force) {
      rooms.delete(key);
      return { ok: true };
    }
    if (!existing || cusId === undefined || existing.cusId !== String(cusId)) {
      return { ok: false, reason: 'NOT_ACTIVE' };
    }
    if (!sessionId || String(sessionId).trim() !== existing.sessionId) {
      return { ok: false, reason: 'SESSION_MISMATCH' };
    }
    rooms.delete(key);
    return { ok: true };
  }

  function get(roomNumber) {
    const entry = live(roomNumber);
    return entry ? { ...entry } : null;
  }

  function touch(roomNumber, sessionId) {
    const entry = live(roomNumber);
    if (!entry || entry.sessionId !== String(sessionId)) return false;
    entry.lastSeen = now();
    return true;
  }

  function expire() {
    let removed = 0;
    for (const [key, entry] of rooms) {
      if (isStale(entry)) {
        rooms.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  function list() {
    expire();
    return Array.from(rooms.values(), e => ({ ...e }));
  }

  function getByCustomer(cusId) {
    const owner = String(cusId);
    return list().find(e => e.cusId === owner) || null;
  }

  function clear() {
    rooms.clear();
  }

  return { acquire, release, get, touch, expire, list, getByCustomer, clear };
}

// Shared instance used by the app
const roomOccupancy = createRoomOccupancy();

module.exports = { createRoomOccupancy, roomOccupancy, DEFAULT_TTL_MS };
