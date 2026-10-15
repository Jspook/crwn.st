// ==========================================================
// Fitting orders service (FITTING_ROOM table)
// An order belongs to a customer's current visit: same CUS_ID, same room,
// and FTR_OrderTime >= the occupancy's `since` (floored to the second).
// Status is derived:
//   FTR_FinishTime NOT NULL            -> complete
//   EMP_ID NOT NULL                    -> preparing
//   otherwise                          -> pending
// ==========================================================

const crypto = require('crypto');
const { query, get, run } = require('../database/db');
const { resolveRoom, getAllRooms } = require('../utils/roomResolver');
const { roomOccupancy } = require('../utils/roomOccupancy');
const { getProductMockImage } = require('../utils/productImages');
const catalog = require('./catalog');

const ROOM_NOT_HELD_MESSAGE = 'คุณไม่ได้อยู่ในห้องลองนี้ กรุณาสแกน QR หน้าห้องลองก่อนสั่งสินค้า';
const INVALID_TRANSITION_MESSAGE = 'ไม่สามารถข้ามขั้นตอนหรือย้อนสถานะได้';

function toDbSecond(ms) {
  return new Date(Math.floor(ms / 1000) * 1000);
}

function visitStart(occ) {
  return toDbSecond(occ.since);
}

// row: { cusId, roomId (FTR_Number), createdAt (FTR_OrderTime) }
function isOrderInVisit(row, occ) {
  if (!occ) return false;
  if (String(row.cusId) !== String(occ.cusId)) return false;
  const r = resolveRoom(row.roomId);
  if (!r || r.roomNumber !== String(occ.roomNumber)) return false;
  const t = new Date(row.createdAt).getTime();
  return Number.isFinite(t) && t >= visitStart(occ).getTime();
}

// row: { EMP_ID, FTR_FinishTime }
function deriveStatus(row) {
  if (row.FTR_FinishTime != null) return 'complete';
  if (row.EMP_ID != null) return 'preparing';
  return 'pending';
}

const ORDER_SELECT = `
      SELECT f.FTR_OrderID as id,
             CASE 
               WHEN f.FTR_FinishTime IS NOT NULL THEN 'complete'
               WHEN f.EMP_ID IS NOT NULL THEN 'preparing'
               ELSE 'pending'
             END as status,
             f.FTR_OrderTime as createdAt,
             f.FTR_FinishTime as finishedAt,
             f.FTR_Number as roomId,
             f.ITV_SKUID as sku,
             f.EMP_ID as empId,
             COALESCE(v.ITV_Size, '-') as size,
             COALESCE(v.ITV_Color, '-') as color,
             COALESCE(i.ITM_Name, 'เสื้อผ้าสำหรับลอง') as productName,
             COALESCE(i.ITM_Price, 0) as price,
             i.ITM_Tag as tag,
             i.ITM_ID as productId,
             e.EMP_FName as staffName,
             f.CUS_ID as cusId
       FROM FITTING_ROOM f
       LEFT JOIN ITEM_VARIANT v ON f.ITV_SKUID = v.ITV_SKUID
       LEFT JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       LEFT JOIN EMPLOYEE e ON f.EMP_ID = e.EMP_ID
    `;

const ORDER_BY = `
      ORDER BY 
        CASE 
          WHEN f.FTR_FinishTime IS NOT NULL THEN 3
          WHEN f.EMP_ID IS NOT NULL THEN 2
          ELSE 1
        END ASC,
        CASE
          WHEN f.FTR_FinishTime IS NOT NULL THEN f.FTR_FinishTime
          ELSE f.FTR_OrderTime
        END DESC,
        f.FTR_OrderID DESC
    `;

function buildOrderQuery(conditions) {
  return ORDER_SELECT + ` WHERE ` + conditions.join(' AND ') + ORDER_BY;
}

function decorate(row, occ, room) {
  row.roomId = occ.roomNumber;
  row.roomDisplay = room.display;
  row.image = getProductMockImage(row.tag, row.productId);
  delete row.cusId;
  return row;
}

// Cap complete orders to the N most recent when a limit is provided
function applyCompleteLimit(orders, limit) {
  const limitNum = parseInt(limit);
  if (isNaN(limitNum) || limitNum <= 0) return orders;
  let completeCount = 0;
  return orders.filter(o => {
    if (String(o.status).toLowerCase() === 'complete') {
      completeCount++;
      return completeCount <= limitNum;
    }
    return true;
  });
}

async function listOrdersForStaff({ staffId, myOnly, limit } = {}) {
  const occs = roomOccupancy.list();
  if (occs.length === 0) return [];

  const byRoom = new Map(occs.map(o => [o.roomNumber, o]));
  const cusIds = [...new Set(occs.map(o => String(o.cusId)))];
  const earliest = new Date(Math.min(...occs.map(o => visitStart(o).getTime())));

  const conditions = [`f.ITV_SKUID IS NOT NULL AND f.ITV_SKUID != ''`];
  const params = [];

  conditions.push(`f.CUS_ID IN (${cusIds.map(() => '?').join(', ')})`);
  params.push(...cusIds);
  conditions.push(`f.FTR_OrderTime >= ?`);
  params.push(earliest);

  if (myOnly && staffId) {
    conditions.push(`(f.EMP_ID = ? OR f.EMP_ID IS NULL)`);
    params.push(staffId);
  }

  const rows = await query(buildOrderQuery(conditions), params);

  const orders = [];
  for (const row of rows) {
    const r = resolveRoom(row.roomId);
    const occ = r && byRoom.get(r.roomNumber);
    if (!isOrderInVisit(row, occ)) continue;
    orders.push(decorate(row, occ, r));
  }
  return applyCompleteLimit(orders, limit);
}

async function listOrdersForCustomer({ cusId, room, limit } = {}) {
  const occ = roomOccupancy.get(room.roomNumber);
  if (!occ || occ.cusId !== String(cusId)) return [];
  roomOccupancy.touch(room.roomNumber, occ.sessionId);

  const conditions = [
    `f.ITV_SKUID IS NOT NULL AND f.ITV_SKUID != ''`,
    `(f.FTR_Number = ? OR f.FTR_Number = ?)`,
    `f.CUS_ID = ?`,
    `f.FTR_OrderTime >= ?`
  ];
  const params = [room.roomNumber, room.barcode, cusId, visitStart(occ)];

  const rows = await query(buildOrderQuery(conditions), params);

  const orders = [];
  for (const row of rows) {
    if (!isOrderInVisit(row, occ)) continue;
    orders.push(decorate(row, occ, room));
  }
  return applyCompleteLimit(orders, limit);
}

function roomNotHeld() {
  return { ok: false, status: 403, code: 'ROOM_NOT_HELD', message: ROOM_NOT_HELD_MESSAGE };
}

function holdsRoom(room, cusId) {
  const occ = roomOccupancy.get(room.roomNumber);
  return occ && occ.cusId === String(cusId) ? occ : null;
}

async function createOrder({ cusId, room, sku, size, color }) {
  if (!holdsRoom(room, cusId)) return roomNotHeld();

  const targetSku = String(sku).trim();

  // Strict lookup: join variant and item
  const variant = await catalog.getVariantWithItem(targetSku);

  if (!variant) {
    return {
      ok: false, status: 400, code: 'INVALID_SKU',
      message: `ไม่พบสินค้า SKU '${targetSku}' ในฐานข้อมูล`
    };
  }

  // Enforce pair invariant between requested size/color and DB variant
  if (size && variant.ITV_Size && String(size).trim().toLowerCase() !== String(variant.ITV_Size).trim().toLowerCase()) {
    return {
      ok: false, status: 400, code: 'VARIANT_MISMATCH',
      message: `ไซส์ '${size}' ที่เลือกไม่ตรงกับ SKU '${targetSku}' (${variant.ITV_Size})`
    };
  }
  if (color && variant.ITV_Color && String(color).trim().toLowerCase() !== String(variant.ITV_Color).trim().toLowerCase()) {
    return {
      ok: false, status: 400, code: 'VARIANT_MISMATCH',
      message: `สี '${color}' ที่เลือกไม่ตรงกับ SKU '${targetSku}' (${variant.ITV_Color})`
    };
  }

  if (Number(variant.ITV_Stock) <= 0) {
    return {
      ok: false, status: 400, code: 'OUT_OF_STOCK',
      message: `สินค้า '${variant.ITM_Name}' (${variant.ITV_Color || ''} - ${variant.ITV_Size || ''}) สินค้าหมดสต็อกชั่วคราว ไม่สามารถสั่งลองได้ (Stock: 0)`
    };
  }

  // Re-check after the await: the lock may have been released or expired meanwhile
  const occ = holdsRoom(room, cusId);
  if (!occ) return roomNotHeld();

  const orderTime = toDbSecond(Date.now());
  const orderId = 'fo_' + crypto.randomUUID();

  await run(
    `INSERT INTO FITTING_ROOM (FTR_OrderID, ITV_SKUID, EMP_ID, FTR_Number, CUS_ID, FTR_OrderTime) VALUES (?, ?, NULL, ?, ?, ?)`,
    [orderId, targetSku, room.roomNumber, String(cusId), orderTime]
  );

  roomOccupancy.touch(room.roomNumber, occ.sessionId);

  return {
    ok: true,
    order: {
      id: orderId,
      roomId: room.roomNumber,
      roomDisplay: room.display,
      sku: targetSku,
      productName: variant.ITM_Name,
      size: variant.ITV_Size,
      color: variant.ITV_Color,
      price: variant.ITM_Price,
      status: 'pending',
      createdAt: orderTime.toISOString()
    }
  };
}

function conflict(error, message) {
  return { ok: false, status: 409, body: { error, message } };
}

async function transitionOrder({ id, status, staffId }) {
  const clean = String(status || '').trim().toLowerCase();
  if (!['pending', 'preparing', 'complete'].includes(clean)) {
    return { ok: false, status: 400, body: { error: 'สถานะไม่ถูกต้อง (Invalid status)' } };
  }

  const row = await get(
    `SELECT FTR_OrderID, CUS_ID, FTR_Number, FTR_OrderTime, EMP_ID, FTR_FinishTime FROM FITTING_ROOM WHERE FTR_OrderID = ?`,
    [id]
  );
  if (!row) {
    return { ok: false, status: 404, body: { error: 'ไม่พบคำสั่งซื้อนี้ในระบบ' } };
  }

  const current = deriveStatus(row);
  const done = (finishedAt) => ({ ok: true, status: 200, body: { success: true, id, status: clean, finishedAt } });

  // a. never go back to pending
  if (clean === 'pending') return conflict('INVALID_TRANSITION', INVALID_TRANSITION_MESSAGE);

  if (current === 'complete') {
    // b. idempotent complete
    if (clean === 'complete') return done(row.FTR_FinishTime);
    // c.
    return conflict('COMPLETE_IMMUTABLE', 'งานนี้นำส่งเรียบร้อยแล้ว แก้ไขไม่ได้');
  }

  // d. the order must belong to a current visit
  const r = resolveRoom(row.FTR_Number);
  const occ = r && roomOccupancy.get(r.roomNumber);
  if (!isOrderInVisit({ cusId: row.CUS_ID, roomId: row.FTR_Number, createdAt: row.FTR_OrderTime }, occ)) {
    return conflict('NOT_ACTIVE', 'ลูกค้าออกจากห้องหรือหมดเวลาแล้ว งานนี้ถูกปิดแล้ว');
  }

  if (current === 'pending') {
    // e.
    if (clean === 'complete') return conflict('INVALID_TRANSITION', INVALID_TRANSITION_MESSAGE);
    // f. claim
    const res = await run(
      `UPDATE FITTING_ROOM SET EMP_ID = ? WHERE FTR_OrderID = ? AND EMP_ID IS NULL AND FTR_FinishTime IS NULL`,
      [staffId, id]
    );
    if (res && res.changes === 1) return done(null);
    return conflict('STALE_ORDER', 'งานนี้ถูกเปลี่ยนแปลงหรือยกเลิกแล้ว กรุณารีเฟรช');
  }

  // current === 'preparing'
  // g.
  if (String(row.EMP_ID) !== String(staffId)) {
    return conflict('NOT_OWNER', 'งานนี้มีพนักงานคนอื่นรับไปแล้ว');
  }
  // h.
  if (clean === 'preparing') return done(null);
  // i. complete
  const finishTime = toDbSecond(Date.now());
  const res = await run(
    `UPDATE FITTING_ROOM SET FTR_FinishTime = ? WHERE FTR_OrderID = ? AND EMP_ID = ? AND FTR_FinishTime IS NULL`,
    [finishTime, id, staffId]
  );
  if (res && res.changes === 1) return done(finishTime);
  return conflict('STALE_ORDER', 'งานนี้ถูกเปลี่ยนแปลงหรือยกเลิกแล้ว กรุณารีเฟรช');
}

// Canonical room list with occupancy and resume capability for the active owner
function listRooms(user) {
  return getAllRooms().map(room => {
    const occ = roomOccupancy.get(room.roomNumber);
    const isOccupied = !!occ;
    const isMyRoom = isOccupied && user && user.role === 'CUSTOMER' && String(occ.cusId) === String(user.id);

    return {
      FTR_Num: room.barcode,
      roomNumber: room.roomNumber,
      roomDisplay: room.display,
      FTR_Status: isOccupied ? 'occupied' : 'available',
      isOccupied,
      isMyRoom,
      canResume: isMyRoom,
      occupantName: isMyRoom ? 'ห้องลองของคุณ (คลิกเพื่อกลับเข้าห้อง)' : (isOccupied ? 'กำลังลองชุด' : null)
    };
  });
}

module.exports = {
  toDbSecond,
  visitStart,
  isOrderInVisit,
  deriveStatus,
  listOrdersForStaff,
  listOrdersForCustomer,
  createOrder,
  transitionOrder,
  listRooms
};
