// Durable session authority. All mutations for a room serialize on its slot row.
const crypto = require('node:crypto');
const db = require('../database/db');

const TTL_MINUTES = 45;

async function lockSlot(tx, roomNumber, create = false) {
  if (create) await tx.run('INSERT IGNORE INTO FITTING_ROOM_SLOT (FTR_RoomNumber) VALUES (?)', [roomNumber]);
  return tx.get('SELECT FTR_ActiveSessionID FROM FITTING_ROOM_SLOT WHERE FTR_RoomNumber = ? FOR UPDATE', [roomNumber]);
}

async function sessionById(tx, id) {
  if (!id) return null;
  return tx.get(`SELECT FTR_SessionID, FTR_RoomNumber, CUS_ID, FTR_EndedAt,
    (FTR_LastSeenAt < DATE_SUB(NOW(), INTERVAL ${TTL_MINUTES} MINUTE)) AS expired
    FROM FITTING_ROOM_SESSION WHERE FTR_SessionID = ?`, [id]);
}

async function closeSession(tx, roomNumber, sessionId, reason) {
  // Cancel only still-pending requests of this exact session. Preparing/complete remain history.
  await tx.run(`UPDATE FITTING_ROOM SET FTR_CancelledAt = NOW()
    WHERE FTR_SessionID = ? AND FTR_Number = ? AND EMP_ID IS NULL
      AND FTR_FinishTime IS NULL AND FTR_CancelledAt IS NULL`, [sessionId, roomNumber]);
  await tx.run(`UPDATE FITTING_ROOM_SESSION SET FTR_EndedAt = NOW(), FTR_EndReason = ?
    WHERE FTR_SessionID = ? AND FTR_EndedAt IS NULL`, [reason, sessionId]);
  await tx.run('UPDATE FITTING_ROOM_SLOT SET FTR_ActiveSessionID = NULL WHERE FTR_RoomNumber = ? AND FTR_ActiveSessionID = ?', [roomNumber, sessionId]);
}

async function acquire(roomNumber, cusId) {
  return db.withTransaction(async tx => {
    const slot = await lockSlot(tx, roomNumber, true);
    if (!slot) throw new Error('Session slot unavailable');
    const active = await sessionById(tx, slot.FTR_ActiveSessionID);
    if (active && !active.FTR_EndedAt && !active.expired) {
      if (String(active.CUS_ID) !== String(cusId)) return { ok: false, reason: 'OCCUPIED' };
      await tx.run('UPDATE FITTING_ROOM_SESSION SET FTR_LastSeenAt = NOW() WHERE FTR_SessionID = ? AND FTR_EndedAt IS NULL', [active.FTR_SessionID]);
      return { ok: true, sessionId: active.FTR_SessionID, resumed: true };
    }
    if (slot.FTR_ActiveSessionID) {
      if (active && !active.FTR_EndedAt) await closeSession(tx, roomNumber, active.FTR_SessionID, 'EXPIRED');
      else await tx.run('UPDATE FITTING_ROOM_SLOT SET FTR_ActiveSessionID = NULL WHERE FTR_RoomNumber = ? AND FTR_ActiveSessionID = ?', [roomNumber, slot.FTR_ActiveSessionID]);
    }
    const sessionId = 'ses_' + crypto.randomUUID();
    await tx.run('INSERT INTO FITTING_ROOM_SESSION (FTR_SessionID, FTR_RoomNumber, CUS_ID) VALUES (?, ?, ?)', [sessionId, roomNumber, cusId]);
    const update = await tx.run('UPDATE FITTING_ROOM_SLOT SET FTR_ActiveSessionID = ? WHERE FTR_RoomNumber = ? AND FTR_ActiveSessionID IS NULL', [sessionId, roomNumber]);
    if (update.changes !== 1) throw new Error('Session slot conflict');
    return { ok: true, sessionId, resumed: false };
  });
}

async function release(roomNumber, { cusId, sessionId, force = false } = {}) {
  return db.withTransaction(async tx => {
    const slot = await lockSlot(tx, roomNumber);
    const active = slot && await sessionById(tx, slot.FTR_ActiveSessionID);
    if (!active || active.FTR_EndedAt || active.expired) return { ok: false, reason: 'NOT_ACTIVE' };
    if (!force && (!sessionId || !cusId || String(cusId) !== String(active.CUS_ID) || sessionId !== active.FTR_SessionID)) {
      return { ok: false, reason: 'SESSION_MISMATCH' };
    }
    await closeSession(tx, roomNumber, active.FTR_SessionID, 'RELEASED');
    return { ok: true, sessionId: active.FTR_SessionID };
  });
}

async function getActive(roomNumber) {
  return db.get(`SELECT s.FTR_SessionID, s.FTR_RoomNumber, s.CUS_ID
    FROM FITTING_ROOM_SLOT slot JOIN FITTING_ROOM_SESSION s ON s.FTR_SessionID = slot.FTR_ActiveSessionID
    WHERE slot.FTR_RoomNumber = ? AND s.FTR_EndedAt IS NULL
      AND s.FTR_LastSeenAt >= DATE_SUB(NOW(), INTERVAL ${TTL_MINUTES} MINUTE)`, [roomNumber]);
}

async function listActive() {
  return db.query(`SELECT s.FTR_SessionID, s.FTR_RoomNumber, s.CUS_ID
    FROM FITTING_ROOM_SLOT slot JOIN FITTING_ROOM_SESSION s ON s.FTR_SessionID = slot.FTR_ActiveSessionID
    WHERE s.FTR_EndedAt IS NULL AND s.FTR_LastSeenAt >= DATE_SUB(NOW(), INTERVAL ${TTL_MINUTES} MINUTE)`);
}

// Used by order create and staff transitions; lock first, then revalidate after any awaited lookup.
async function withLockedActive(roomNumber, { cusId, sessionId } = {}, work) {
  return db.withTransaction(async tx => {
    const slot = await lockSlot(tx, roomNumber);
    const active = slot && await sessionById(tx, slot.FTR_ActiveSessionID);
    if (!active || active.FTR_EndedAt || active.expired ||
        (cusId !== undefined && String(active.CUS_ID) !== String(cusId)) ||
        (sessionId !== undefined && active.FTR_SessionID !== sessionId)) {
      return { ok: false, reason: 'NOT_ACTIVE' };
    }
    return { ok: true, value: await work(tx, active) };
  });
}

module.exports = { acquire, release, getActive, listActive, withLockedActive };
