# แผนงาน: 10 ห้องลองเสื้อ, ตัด occupancy ออกจาก DB, ปิดการเข้าห้องแบบกดเลือก

> วันที่: 2026-10-14 | สถานะ: **ดำเนินการเสร็จสิ้นครบทุกเฟส (เฟส 1 - 8)** | ผลการทดสอบ: ผ่าน 100% (67/67 เคส)
> รายงานก่อนหน้าที่เกี่ยวข้อง: [[2026-10-14 Room Exit Regression]], Archive ของรอบ audit ก่อนหน้า

---

## 1. การตัดสินใจที่อนุมัติแล้ว

| # | หัวข้อ | ผลการตัดสินใจ |
|---|---|---|
| D1 | QR ห้อง 1 | `5684848452325` (ลงท้าย 325) |
| D2 | QR ห้อง 2–10 | สร้างตามกฎ `5684848452324 + N` → ห้อง 2 = `…326` ... ห้อง 10 = `…334` (ต้องตรวจกับสติกเกอร์จริงก่อน deploy) |
| D3 | Mapping | ใช้ object map ในโค้ด (`utils/roomResolver.js`) **ไม่สร้างตารางใหม่** |
| D4 | `FTR_Number` | เก็บเลขห้อง `'1'`–`'10'` (string) แทนบาร์โค้ด |
| D5 | Column ที่ลบ | `FTR_CustomerPresent`, `FTR_SessionID`, `FTR_ReleasedAt` |
| D6 | Column ที่คง | `CUS_ID` (ผูกเจ้าของ order) |
| D7 | สถานะห้องที่ใช้งานอยู่ | เก็บใน **server memory** (ไม่ใช่ DB) |
| D8 | Banner กลับเข้าห้องลอง | **ตัดออก** (ทางเลือก B): ไม่มี banner บน dashboard; สแกน QR ซ้ำได้เฉพาะถ้า memory ระบุว่าห้องนั้นเป็นของ `CUS_ID` ที่ login อยู่; ถ้าเป็นคนอื่นแสดง "ห้องนี้กำลังใช้งาน" |
| D9 | การเข้าห้อง | ลบปุ่ม "สแกน QR ห้อง N" แบบกดเลือก เหลือ **สแกน QR** และ **กรอกรหัส QR** เท่านั้น |
| D10 | หลักฐาน/ข้อมูลเก่า | แถว `occ_…` **ห้ามลบ** ให้ archive (ย้ายไปตารางประวัติ หรือ export ก่อน) |
| D11 | DB | ต้อง backup และมี rollback script ก่อนรัน DDL/UPDATE ทุกครั้ง |

---

## 2. หลักฐานปัจจุบัน (อ้างอิงจากการอ่าน code และ DB แบบ read-only)

### 2.1 อาการที่ผู้ใช้รายงาน
- **รูป 1 (มือถือ, โดเมน tunnel ผ่าน Instagram in-app browser):** แถบ "ออกจากห้องลองเสื้อ (ห้อง 1)" ปุ่ม "เสร็จสิ้น" disabled และมี alert `ไม่สามารถออกจากห้องลองได้ กรุณาลองใหม่อีกครั้ง` → release ล้มบน build ที่ tunnel ใช้อยู่
- **รูป 2 (หน้าสแกน QR):** แบนเนอร์ `Forbidden — customer session required` (ภาษาอังกฤษ) และปุ่ม "สแกน QR ห้อง 1–4 · ห้องว่าง" ที่กดเข้าได้โดยตรง

### 2.2 จุดที่ต้องแก้ (อ้างจาก grep ล่าสุด)

| ไฟล์ | บรรทัดโดยประมาณ | สิ่งที่ทำอยู่ | ผลกระทบ |
|---|---|---|---|
| `utils/roomResolver.js` | :6–:22 | Registry และ alias แบบ hardcode 4 ห้อง | ต้องขยายเป็น 10 ห้อง |
| `views/customer/fitting-room.ejs` | :2–:12 | `ROOM_DISPLAY_MAP` ซ้ำซ้อนแค่ 1–4 และ fallback `replace(/^568484845232/,'')` | ห้อง 5 จะแสดงเป็น `9` (ผิด) |
| `routes/api.js` | :391, :405–:412 | Filter ตาม `FTR_ReleasedAt`, `FTR_SessionID` | ต้องเปลี่ยนไปใช้ memory |
| `routes/api.js` | :472–:489 | สร้างรายการห้องจาก `FTR_CustomerPresent` | ต้องเปลี่ยนไปใช้ memory |
| `routes/api.js` | :514–:575 | Enter: ตรวจ active, release เก่า, **INSERT แถว `occ_…`** (:564–:570) | ต้องแทนด้วย memory lock + ไม่ INSERT occ |
| `routes/api.js` | :597–:655 | Release: ตรวจ session, UPDATE `FTR_ReleasedAt` / `FTR_CustomerPresent` | ต้องเปลี่ยนเป็นลบจาก memory |
| `routes/api.js` | :683–:704 | Cart/QR สำหรับ room ที่ active | ต้องอ่านจาก memory |
| `routes/api.js` | :758–:759 | INSERT order ที่มี `FTR_SessionID` | ต้องตัด column |
| `routes/api.js` | :793–:797 | Staff: เช็ค `FTR_ReleasedAt` ก่อนอัปเดต | ต้องตัดการเช็คนี้ |
| `routes/api.js` | :822–:826 | `PATCH status='pending'` ตั้ง `FTR_FinishTime = NULL` | ไม่ immutable (เดิมบันทึกไว้แล้ว) |
| `routes/views.js` | :78–:107 | Dashboard query `activeRoom` จาก DB | ต้องเปลี่ยนเป็น memory (หรือลบตาม D8) |
| `routes/views.js` | :114–:161 | ประตู fitting-room ตรวจ session จาก DB | ต้องเปลี่ยนเป็น memory |
| `views/customer/dashboard.ejs` | :14–:25 | Banner `active-room-resume-banner` | **ลบ** ตาม D8 |
| `public/js/app.js` | :266–:268, :497–:510 | เก็บ `crwn_active_session_*` ใน localStorage | ลบ/ย้ายไปการตอบกลับจาก server |
| `test/room-exit.test.js` | :77, :158 | ทดสอบ `ses_current` และ mock `FTR_SessionID` | ต้องเขียนใหม่ตาม memory model |
| `tests/roomResolver.test.js` | ทั้งไฟล์ | assert ว่ามี 4 ห้องและ `'5'` ไม่ valid | ต้องอัปเดตเป็น 10 ห้อง (ไฟล์นี้อยู่ใต้ `tests/` ที่ถูก gitignore) |
| `tests/audit-regression.test.js` | :387–:398 | assert ห้อง 1, 4 และ alias `'2'` | ตรวจว่ายังผ่านหลังขยาย |

**หมายเหตุ:** ไม่มี `FOREIGN KEY` ที่ `CUS_ID` ใน schema ของ `FITTING_ROOM` (ตามการตรวจ `information_schema` ครั้งก่อน)

### 2.3 สถานะข้อมูลใน DB ที่ยังไม่ผ่านการยืนยัน
- **จำนวนแถว `fitting_room`:** บันทึกเดิม 14 แถว แต่การตรวจล่าสุด (read-only) พบ **3 แถว**: `fo_6…` (1), `fo_e…` (1), `occ_…` (1) ทั้งหมดเก็บ `FTR_Number = 5684848452326`
- **สาเหตุยังไม่ทราบ** ต้องตรวจก่อนลบอะไรก็ตาม (อาจเป็น reset/seed โดยคนอื่น หรือการบันทึกผิดพลาด)
- แถว `occ_…` ล่าสุดมี `FTR_CustomerPresent = 0` และ `FTR_ReleasedAt` มีค่า แปลว่าเป็นประวัติ session ที่ปิดแล้ว

---

## 3. Root cause และความเสี่ยงของการออกแบบเดิม

| ID | ปัญหา | หลักฐาน | ระดับหลักฐาน |
|---|---|---|---|
| RC-1 | Release POST ไม่มี body → `req.body.sessionId` TypeError → 500 → client กลืน error แล้ว navigate ต่อ → session ค้าง → banner กลับมา | `routes/api.js` ก่อนแก้, RED 5/5 ก่อนแก้ | **ยืนยันด้วย test** |
| RC-2 | `FTR_Number` เก็บบาร์โค้ดดิบ ทำให้ลูกค้าเห็นและ join กับ mapping ไม่ได้ | แถวจริงทั้ง 3 แถว | **ยืนยันด้วย DB read-only** |
| RC-3 | Mapping hardcode 4 ห้อง และ `ROOM_DISPLAY_MAP` ซ้ำใน EJS | `utils/roomResolver.js`, `fitting-room.ejs:2–:12` | ยืนยันด้วย code |
| RC-4 | Occupancy ใช้ DB หลาย column ทำให้ session ค้างได้เมื่อ release ล้ม | ทุกจุดในตาราง 2.2 | ยืนยันด้วย code |
| RC-5 | ปุ่มเข้าห้องแบบกดเลือกเปิดให้เข้าซ้ำได้ | รูป 2 | **ยืนยันด้วยภาพ** |
| RC-6 | บนมือถือผ่าน tunnel ยังล้ม release | รูป 1 | **ยังไม่ยืนยัน** (ต้องทราบว่า tunnel ชี้ไป build ไหน) |
| RC-7 | Forbidden ภาษาอังกฤษ และไม่บอกว่าต้อง login ก่อน | รูป 2 | ยืนยันด้วยภาพ |

---

## 4. ข้อควรระวังของ D7 (memory occupancy)

- **single process:** memory lock ใช้ได้เฉพาะเมื่อรัน Node process เดียว ต้องยืนยันก่อนว่า deployment ไม่ใช้ cluster หรือหลาย instance ถ้าใช่ต้องย้ายไป Redis หรือกลับมาใช้ DB lock
- **restart:** server restart แล้วห้องว่างทั้งหมด ยอมรับได้เพราะมีประตูล็อกทางกายภาพ แต่ต้องบันทึกใน runbook
- **race:** การตรวจและ set ใน memory ต้องทำแบบ synchronous ไม่มี `await` คั่นกลาง
- **TTL:** ต้องมี timeout ป้องกัน lock ค้างเมื่อลูกค้าปิดแท็บ (ค่าที่ต้องกำหนด เช่น 30–60 นาทีโดยไม่มี heartbeat — **ต้องถามผู้ใช้**)

---

## 5. ลำดับการแก้ (แต่ละเฟสต้องรออนุมัติก่อนเริ่ม)

### เฟส 0 — ตรวจสอบก่อนแก้ (read-only เท่านั้น)
1. ยืนยันว่า tunnel ที่มือถือใช้อยู่ชี้ไป build/branch ใด (รูป 1)
2. ตรวจจำนวนแถว `fitting_room` ซ้ำ และหาสาเหตุ 14 → 3
3. ยืนยันว่า deployment เป็น single process หรือไม่
4. ทำ reproduce รูป 2 (Forbidden) บนเบราว์เซอร์ที่ไม่มี session
- **ไม่แก้ไฟล์ใดๆ**

### เฟส 1 — Registry 10 ห้อง (code-only, ไม่แตะ DB)
- แก้ `utils/roomResolver.js`: สร้าง registry จาก base ค่าเดียวด้วย loop (ไม่ใช้ if/else)
- แก้ `tests/roomResolver.test.js` ให้ตรวจ 10 ห้อง, ห้อง 5–10 ผ่าน barcode และ alias, ค่าเกิน (`'11'`, `…335`) ต้อง null
- ตรวจ `tests/audit-regression.test.js` ยังผ่าน
- **RED ก่อน GREEN:** เขียน test ให้ fail ก่อนแก้ registry

### เฟส 2 — แก้ display ฝั่ง view
- แทน `ROOM_DISPLAY_MAP` ใน `fitting-room.ejs` ด้วยค่าที่ส่งจาก server (`resolveRoom`)
- ลบ fallback `replace(/^568484845232/,'')` (ผิดสำหรับห้อง 5–10)
- Test: ห้อง 5 แสดง `5`, ห้อง 10 แสดง `10`

### เฟส 3 — Occupancy ใน memory (สำคัญที่สุด, ต้องมี test ก่อน)
- สร้างโมดูล `utils/roomOccupancy.js`: Map ของ `roomNumber → { cusId, sessionId, since, lastSeen }` พร้อม `acquire`, `release`, `get`, `touch`, `expire`
- เขียน test ทั้งหมดก่อน: acquire ห้องว่าง, acquire ซ้ำโดยเจ้าของเดิม (resume), acquire โดยคนอื่น (ต้องปฏิเสธ), release ด้วย session ผิด (ปฏิเสธ), release ซ้ำ, TTL หมดอายุ, ห้องแยกกันไม่กระทบกัน
- แทนที่ logic ใน `routes/api.js` :391–:704 และ `routes/views.js` :78–:161 ทีละจุด พร้อม test ของแต่ละจุด
- **ลบ** การ INSERT แถว `occ_…` (`routes/api.js:564–:570`)

### เฟส 4 — ลบ column ออกจาก order flow
- ตัด `FTR_SessionID` ออกจาก INSERT (`routes/api.js:758–:759`)
- ลบการเช็ค `FTR_ReleasedAt` ใน staff PATCH (`routes/api.js:793–:797`)
- Test: order flow ยังสร้างและอัปเดตสถานะได้โดยไม่มี column เหล่านั้น

### เฟส 5 — UI (ลบการกดเข้าห้อง, เพิ่มช่องรหัส, แปลข้อความ)
- ลบ banner ที่ `views/customer/dashboard.ejs:14–:25`
- ลบปุ่ม "สแกน QR ห้อง N" แบบกด ใน room modal (`views/partials/room-modal.ejs`, `public/js/app.js:232–:260`)
- เพิ่มช่องกรอกรหัส QR และต้องผ่าน `resolveRoom` ก่อนส่ง
- ข้อความ Forbidden แปลเป็นไทย เช่น "กรุณาเข้าสู่ระบบก่อนสแกน QR"
- E2E ด้วย browser: สแกนสำเร็จ, กรอกรหัสผิด, สแกนห้องที่มีคนอื่น, สแกนซ้ำห้องเดิมหลัง refresh

### เฟส 6 — แก้ release ฝั่ง client (รูป 1)
- คงการแก้ที่ทำไว้แล้วใน `fitting-room.ejs` (`releaseCurrentRoom()` ส่ง JSON + เช็ค `res.ok`) และตรวจว่า build บน tunnel มีการแก้นี้
- Test ใหม่: release ด้วย session ที่ server ไม่รู้จัก ต้องตอบ error ที่ client แสดงได้

### เฟส 7 — ฐานข้อมูล (**ต้องอนุมัติแยกอีกครั้ง**)
1. **ยืนยันจำนวนแถวและสาเหตุ 14 → 3** ก่อน
2. Backup: `mysqldump` ของตาราง `fitting_room` (และทั้ง DB ถ้าทำได้) ไปที่ `Audit/` หรือโฟลเดอร์ backup นอก repo โดยไม่พิมพ์ค่าเชื่อมต่อ
3. Archive แถว `occ_…` ไปตาราง `FITTING_ROOM_ARCHIVE` (**ต้องถามก่อนว่าให้สร้างตารางใหม่ไหม** เพราะขัดกับ D3 — อาจเปลี่ยนเป็น export CSV แทน)
4. Migration `FTR_Number`: แปลงบาร์โค้ดเป็นเลขห้องด้วย mapping ที่อนุมัติ (เช่น `…326` → `'2'`) ก่อนเปลี่ยนความหมายของ column
5. `ALTER TABLE` ลบ `FTR_CustomerPresent`, `FTR_SessionID`, `FTR_ReleasedAt`
6. Rollback script ที่เก็บคู่กัน
7. ทดสอบ migration บนสำเนาก่อน (ห้ามรันบน DB จริงโดยตรง)

### เฟส 8 — ตรวจรวม
- `npm test` (ชุด mock เท่านั้น)
- E2E บนเบราว์เซอร์และ tunnel
- อัปเดต ERD ให้ตรงกับ schema จริง (ERD เดิมไม่มี `CUS_ID`, `FTR_CustomerPresent`, `FTR_SessionID`, `FTR_ReleasedAt` ทั้งที่ DB มี)

---

## 6. แผนทดสอบ (Test Matrix)

| กลุ่ม | กรณี | ประเภท |
|---|---|---|
| Registry | QR 10 ค่าผ่าน, alias 1–10, ค่าเกิน/ผิดรูปแบบ null | unit |
| Occupancy | acquire ว่าง, resume เจ้าของเดิม, ปฏิเสธคนอื่น, release ถูกต้อง/ผิด, TTL, ห้องแยกกัน | unit |
| Race | acquire สองครั้งพร้อมกัน ต้องมีแค่หนึ่งผู้ชนะ | unit (synchronous) |
| API | enter/release/cart/staff PATCH หลังตัด column | integration (mock DB) |
| UI | ปุ่ม back, refresh, re-entry ของเจ้าของ, ห้องคนอื่น, รหัสผิด | E2E browser |
| มือถือ | tunnel + in-app browser: release สำเร็จ, Forbidden แปลแล้ว | E2E manual |
| DB | migration บนสำเนา, rollback ได้, จำนวนแถวตรงก่อนและหลัง | ตรวจด้วย SQL read-only หลังรัน |

**กฎ:** test ที่เขียน DB จริงต้องไม่รันใน `npm test` (ตาม T00) และต้องใช้ DB ทดสอบแยกต่างหาก

---

## 7. ความเสี่ยงที่ยังเปิดอยู่
- ข้อมูล 14 → 3 แถวยังไม่มีคำอธิบาย
- ค่า QR ห้อง 2–10 ยังไม่ตรวจกับสติกเกอร์จริง
- ไม่ทราบ build/tunnel ที่มือถือใช้
- ไม่มี FK ที่ `CUS_ID`
- `tests/` ถูก gitignore → test ที่อยู่ใต้ `tests/` ไม่ถูก commit
- `POST /api/auth/logout` ยังลบ `pay_cart_item` (`routes/auth.js:177–180`) ยังไม่ได้แก้ นอกขอบเขตแผนนี้
- Timezone: DB ประกาศ +07 แต่ `NOW()` ตรงกับ UTC ของ host (ต่าง 7 ชั่วโมง) ต้องแก้ก่อนใช้ `NOW()` ใน logic ใหม่

---

## 8. คำถามที่ยังต้องการคำตอบก่อนเริ่มเฟส 3 ขึ้นไป
1. **TTL ของ occupancy:** กี่นาทีโดยไม่มีกิจกรรม ถึงจะปล่อยห้องอัตโนมัติ (แนะนำ 30–60 นาที)?
2. **การ archive `occ_…`:** เก็บในตารางใหม่ (ขัดกับ D3) หรือ export CSV?
3. **Deployment:** รัน process เดียวหรือไม่?
4. **Tunnel ของมือถือ:** ชี้ไปที่เครื่องไหน/branch ไหน?

---

## 9. การย้อนกลับ
- ระหว่างการทำงานรอบนี้ ผู้ช่วยเคยแก้ `utils/roomResolver.js` และ `tests/roomResolver.test.js` ก่อนได้รับคำสั่งให้เขียนแผนอย่างเดียว ตอนนี้ย้อนกลับแล้ว:
  - `utils/roomResolver.js` คืนค่าจาก git (`git checkout`) ไม่มีการแก้ค้าง
  - `tests/roomResolver.test.js` ย้อนค่าด้วยมือให้เหมือนเดิม (ไฟล์นี้ไม่ถูก track ใน git)
- ไม่มีการแก้ DB หรือรัน DDL ใดๆ

---

## เอกสารเชื่อมโยง
- [[2026-10-14 Room Exit Regression]] — รอบแก้ release และ session ก่อนหน้า
- Archive: `Audit/Archive/` (รอบ audit เดิม 01–10)
