# crwn.st — Room Exit Regression (2026-10-14)

> **สถานะ:** แก้โค้ดแล้ว, ทดสอบแบบ isolated ผ่าน; ยังไม่ได้ทดสอบ browser + live DB รอบใหม่. ประวัติ Audit รอบก่อนย้ายไป `Archive/` โดยไม่ลบ: [[10-browser-e2e-run]], [[09-independent-verification]].

## อาการ

ลูกค้า สมชาย ใจดี อยู่ห้องลอง 1 กดออก → “นำใส่ตะกร้าแล้วชำระเงิน” หรือ “นำใส่ตะกร้าแล้วเลือกซื้อต่อ” → หน้า dashboard ยังขึ้นปุ่ม “กลับเข้าห้องลองของคุณ” ทั้งที่ควรปล่อยห้องแล้ว.

## Root cause (ยืนยันจาก source + RED test)

```text
views/customer/fitting-room.ejs:302-308 (เดิม)
POST /api/fitting-rooms/:roomId/release  [ไม่มี body/Content-Type]
   ↓
routes/api.js:624 (เดิม)
req.body.sessionId  → TypeError เมื่อ req.body = undefined → HTTP 500
   ↓
releaseCurrentRoom() กลืนความล้มเหลว แล้ว exitAndAddToCart()
ยัง redirect ไป checkout/dashboard → session occupancy ไม่ถูกปล่อย
   ↓
routes/views.js:78-103 ค้น active session แล้วแสดง resume banner
```

**RED:** `node --test test/room-exit.test.js` ก่อนแก้ failed **5/5**: client ไม่ส่ง JSON session ID, release 500 ยังถูกนับว่าสำเร็จ, ทั้งสองปุ่มยัง navigate เมื่อ release ล้มเหลว, API no-body คืน 500.

## แก้ไข

- `views/customer/fitting-room.ejs`: `releaseCurrentRoom` ส่ง `Content-Type: application/json` พร้อม `sessionId` ของห้องปัจจุบัน; ยอมรับผลเฉพาะ `HTTP 2xx` + `success:true`; หากล้มเหลวแสดง error และ **ไม่ redirect**. คง modal/ปุ่ม retry และ localStorage ไว้จน release สำเร็จ. ครอบคลุม 3 ทางออก: ไม่มีคำขอ, เพิ่มตะกร้าไป checkout/เลือกซื้อต่อ, ไม่นำใส่ตะกร้า.
- `routes/api.js`: รับ POST no-body จาก client เก่าด้วย `req.body?.sessionId`; authorization ยังตรวจ active customer/session ด้วย DB ก่อนปล่อย.
- `test/room-exit.test.js`: ทดสอบ client function จริงที่ extract จาก EJS + API route จริงบน mock DB; ทดสอบสองปุ่มทั้ง failure และ success, release no-body compatibility, retry path. ไฟล์นี้อยู่ใน `test/` (ไม่ใช่ `tests/` ที่ถูก `.gitignore`).
- `package.json`: รวม `test/room-exit.test.js` เข้า `npm test`.

## ผลทดสอบ

| คำสั่ง | ผล |
| --- | --- |
| `node --test test/room-exit.test.js` | **9/9 pass** (ก่อนแก้ 5/5 fail) |
| `npm test` | **31/31 pass** (mock-only; ไม่แตะ DB จริง) |
| `ejs.compile(views/customer/fitting-room.ejs)` | ผ่าน |
| `node --check routes/api.js`, `node --check test/room-exit.test.js`, `git diff --check` | ผ่าน |

## ขอบเขตที่ยังต้องระวัง

1. **ยังไม่ยืนยัน live E2E หลังแก้** เพราะ server `:3000` ถูกปิดตามคำสั่งก่อนหน้า; ไม่เปิด/เขียน DB จริงเองในรอบนี้. หากจะรับรองปลายทาง: login ทดสอบผ่าน UI → สร้างคำขอ/พนักงานนำส่ง → กดสองทางออกทีละ session → ตรวจ `FTR_ReleasedAt` และ dashboard banner; ระวังข้อมูลจริง. แนะนำ test DB แยก.
2. `Cart.syncBackend()` ใน `public/js/cart.js` ยังไม่เช็ค HTTP status และกลืน network error — คนละปัญหากับ occupancy; แม้ release สำเร็จ cart sync อาจ fail ได้ ควรแยก task.
3. `tests/roomResolver.test.js` และ `tests/audit-regression.test.js` ยังถูก `.gitignore` และไม่ได้ track ใน Git — `npm test` อาจพังบน clone ใหม่ จัดการใน task แยก.
4. เอกสาร Archive คือหลักฐานประวัติ ไม่ใช่ acceptance ของ code ปัจจุบัน.

## Archive inventory

`Audit/Archive/` มีรายงานเก่า **10 ฉบับ** (`01-system-map.md` ถึง `10-browser-e2e-run.md`) ย้ายแบบ rename โดยตรวจจำนวนก่อน/หลัง ไม่ลบ/เขียนทับ; Audit root เหลือรายงานนี้.

## เอกสารเชื่อมโยง

- [[02-bug-investigation]] — ที่มาของ room/session bug รอบก่อน (Archive)
- [[10-browser-e2e-run]] — E2E เดิมที่ยังไม่ได้ทดสอบปุ่มสองทางออก (Archive)
