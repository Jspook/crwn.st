# Independent verification of the remediation report (2026-10-14)

> ผมไม่ได้เชื่อรายงาน `audit_remediation_report.md` โดยตรง แต่ตรวจกับ **โค้ดที่ commit จริง (cf395c5) + ฐานข้อมูลจริง + การรัน `npm test` เอง + การ boot server จริง** ทุกข้อด้านล่างมีหลักฐานที่ทำซ้ำได้ การเชื่อมต่อ DB ใช้ read-only และการยิง endpoint ที่ควรถูกปฏิเสธใช้ signed cookie ที่สร้างเอง (ไม่ผ่าน `POST /login`) พร้อมนับแถวก่อน/หลังเพื่อพิสูจน์ว่าไม่มี write

## 1. สถานะ commit และการแพ็กเกจ

| รายการ | ผลตรวจ |
| --- | --- |
| commits ใหม่ | `cf395c5` (แก้โค้ด 13 ไฟล์ +622/−249), `9e1a2e3`, `4f8ca04` (gitignore/lบบางสคริปต์) |
| working tree | สะอาด (clean) |
| `Audit/` | มี **8 ไฟล์ของผม** เท่านั้น — รายงานอ้าง `Audit/02-defect-backlog.md` และ `Audit/03-remediation-plan.md` ซึ่ง**ไม่มีอยู่จริง** |
| `tests/` | **ถูก gitignore** (`tests/`) → `tests/roomResolver.test.js` และ `tests/audit-regression.test.js` **ยังไม่ถูก commit** มีเพียง `api.test.js` ที่ tracked |
| ผลกระทบ | `npm test` = `node --test tests/roomResolver.test.js tests/audit-regression.test.js` → โคลนใหม่แล้วรันจะ **fail ทันที** เพราะไฟล์ test ไม่ถูกติดไปด้วย |

## 2. สิ่งที่ยืนยันว่าถูกต้องจริง (independently reproduced)

| ข้ออ้างในรายงาน | หลักฐานที่ผมเก็บเอง |
| --- | --- |
| `npm test` = 22 tests / 8 suites / pass 100% | รันเองได้ `tests 22, suites 8, pass 22, fail 0` (คนละอย่างกับที่รายงานว่า ~300ms; ของจริง ~506ms — ไม่มีนัย) |
| Safety guard กันการยิง live DB | รัน `DB_HOST=webdev.it.kmitl.ac.th node --test tests/api.test.js` → abort ด้วยข้อความ `[SAFETY ABORT]` ก่อนต่อ DB (ผมบังคับ `DB_PORT=1` กันไว้ด้วย เผื่อ guard พลาด) |
| BUG-007 unknown QR ถูกปฏิเสธ | live: `POST /api/fitting-rooms/53636636373363/enter` → **400** |
| BUG-006 atomic + same-owner resume + scoped release | โค้ด: `withTransaction` + `SELECT ... FOR UPDATE` (enter/release) ✓; live: ลูกค้าอื่นเข้าห้องที่ถูกครอบครอง → **409**; release โดยไม่มี session → **403**; แถวใน DB **14 / active 1 ไม่เปลี่ยน** หลังยิงชุดนี้ |
| BUG-002 cart ส่ง metadata ครบ | live `GET /api/cart` (u2): `{sku, productId:"p1", tag:"top", image:"/images/products/top-2.jpg", …}` — ตรงกับ product API แล้ว ไม่ใช่ `top-1.jpg` แบบเดาจาก SKU อีก |
| Cart wipe on login ถูกลบจริง | `routes/auth.js:147` เหลือคอมเมนต์ `// Preserve customer's existing cart items across login sessions` ไม่มี DELETE แล้ว |
| BUG-005 ส่ง `finishedAt` | live `GET /api/fitting-orders`: keys มี `finishedAt`; ตัวอย่าง `createdAt 04:27:21` กับ `finishedAt 04:27:28` ต่างกันจริง; PATCH ใช้ `COALESCE(FTR_FinishTime, NOW())` + API `ORDER BY` ใช้ finish time สำหรับ complete |
| BUG-003 migrate แล้ว | **DB จริงเป็น `female` ทั้ง p52/p54/p56/p58/p60** และ skirt ทั้งหมด = `female:10` (ไม่มี male+skirt เหลือ) |
| BUG-001 resume flow | live `GET /customer/dashboard` ของเจ้าของห้อง → มี `active-room-resume-banner`; `/api/fitting-rooms` คืน `isMyRoom/canResume`; `selectRoom()` เช็ค `res.ok` และโชว์ 409 แทนการ navigate ต่อ |
| BUG-004 pair invariant | `submitItemRequest` ปฏิเสธคู่ที่ไม่มีจริงด้วย toast และ return (ไม่สร้าง SKU ปลอม); `renderColorOptions` กรองสีตามไซส์ที่เลือก; API คืน `400 VARIANT_MISMATCH` แบบ case-insensitive |

## 3. ข้ออ้างที่แรงเกินหลักฐาน / ยังไม่จริง

1. **"Verified" เชิงพฤติกรรมยังพิสูจน์ไม่ได้สำหรับห้อง/คิว** — test 22 ตัวรันบน **mock handler ที่ match SQL ด้วย string** (`tests/audit-regression.test.js:120-370`) ถ้า SQL จริงถูกแก้ให้ไม่ตรง pattern mock จะคืน `null/[]` เงียบ ๆ (บรรทัด 367-369) → test ยังเขียวทั้งที่พฤติกรรมจริงพัง นี่คือ mock-vs-mock ไม่ใช่ระบบจริง
2. **"Atomic / concurrency" ไม่ได้ถูกทดสอบ** — ไม่มี test ที่ยิง 2 request พร้อมกันจริง (`FOR UPDATE` ทดสอบผ่าน mock ไม่ได้) การกัน double-booking จึงยังเป็น **code-level claim** ไม่ใช่ผลทดสอบ
3. **Test 2 ตัวไม่มีความหมาย (tautology / vacuous)**
   - `T03` ตัวที่ 2 เปิดไฟล์ `.sql` มาอ่านแล้ว regex ว่ามีข้อความ `'p52','p54'` → เป็นการทดสอบว่า "ไฟล์ถูกเขียน" ไม่ได้ทดสอบว่า migration ทำงาน/ถูก apply/ไม่ error
   - `Cart Wipe Prevention` assert ว่า `routes/auth.js` **ไม่มี** สตริง `DELETE FROM PAY_CART_ITEM WHERE CUS_ID = ?` — แต่สตริงเดิมใน `1804205:routes/auth.js:149` คือ `... WHERE PAY_CART_ID = ?` → **test นี้เขียวมาก่อนแก้ด้วยซ้ำ** จึงตรวจจับ regression ตัวที่มันอ้างว่ารักษาไม่ได้เลย
4. **T01 ไม่มี test** — ตารางในรายงานให้ ✅ แต่ไม่มี test เคส resume/Back เลย พฤติกรรม Back/Refresh/BFCache ยังไม่ถูกทดสอบ
5. **"staff sorting by completion time" จริงแค่ครึ่งเดียว** — API เรียงตาม finish time ✓ แต่ client `views/staff/fitting.ejs:128-129` ยัง re-sort คอลัมน์ complete ด้วย `createdAt` → ลำดับบนจอไม่ตรงกับที่ API ส่งมา
6. **"immutable timestamping" ไม่ครบ** — PATCH `status='pending'` ยังตั้ง `FTR_FinishTime = NULL` (`routes/api.js:822-826`) → complete → pending ลบเวลาได้ (และ complete → preparing เหลือ finish time ค้าง)

## 4. สิ่งที่ยังค้างในระบบจริง (ไม่ใช่แค่ทฤษฎี)

1. **ข้อมูลเก่าไม่ถูก backfill** — DB จริงยังมี complete **4 ใบที่ `FTR_ReleasedAt` เป็น NULL** จากก่อนแก้ → staff Kanban เห็นเฉพาะ complete เก่าเหล่านี้ (n=4 ทั้งหมด complete) ไม่มีงาน pending/preparing ให้เห็น เพราะถูกปล่อยไปหมดแล้ว
2. **มี session ค้างจริง 1 ห้อง** (`u1` ห้อง 5684848452325, active >50 นาที) — โค้ดใหม่ไม่ purge ของเก่า แต่มี resume banner ให้เจ้าของแล้ว
3. **การ apply migration ไม่ reproducible** — ไม่มี runner/skript/คำสั่งใน README ที่รัน migration; DB live เป็น female แปลว่า **ถูกรันมือ** เครื่อง/เพื่อนร่วมงานคนอื่นรันตามไม่ได้
4. **client release ยังไม่ตรวจผลลัพธ์** — `views/customer/fitting-room.ejs:302-308` ยัง `fetch(...)` แล้วไม่เช็ค `res.ok` → ถ้า release ล้มเหลว UI ยัง navigate ออกไป ทำให้ห้องค้าง (ครึ่งที่เหลือของ BUG-001)
5. **`database/db.js` ใส่ mock hook เข้าโมดูล production** — มี `USE_MOCK_DB` กันไว้และ throw ถ้า set ผิด (ทดสอบได้ว่า throw) แต่เป็น test concern ที่อยู่ในเส้นทาง production
6. **`views/customer/fitting-room.ejs` ยังมี `ROOM_DISPLAY_MAP` ของตัวเอง** ซ้ำกับ `utils/roomResolver.js` (cosmetic แต่คือสิ่งที่ BUG-007 ตั้งใจจะกำจัด)
7. `tests/` ที่ gitignore ทำให้ `npm test` พังบน clone ใหม่ (ข้อ 1.3) และ `tests/api.test.js` (integration ชุดเดิม ~15 เคส) **ไม่อยู่ใน `npm test` แล้ว** → coverage ลดลงแต่รายงานอ่านเหมือน "100%"

## 5. ตรวจไม่มี side effect

`rows_before = {n:14, active:1}` และ `rows_after = {n:14, active:1}` → UNCHANGED ✓ ระหว่างการยิง `/enter` (unknown 400 / occupied 409) และ `/release` (403) ทั้งหมดไม่มี write ลง DB จริง

## 6. สรุปการประเมิน

**ผ่านจริง**: BUG-002, BUG-003 (รวม migrate live), BUG-004, BUG-005 (API+UI), BUG-006/007 ในเส้นทางหลัก, cart-wipe fix, safety guard — ตรวจกับ DB จริงและโค้ดจริงแล้ว
**โค้ดถูกแต่ไม่มีหลักฐานทดสอบ**: concurrency/atomic race, T01 navigation, mock ที่กลืน SQL แปลก
**ต้องแก้ก่อนปิดงาน**: commit ไฟล์ test (หรือยกเลิก gitignore `tests/`), เพิ่ม test ที่ assert พฤติกรรมจริง (ลบ 2 เคส tautology แล้วแทนด้วย test ที่ต่อ DB ทดสอบ), แก้ sort ฝั่ง client, block ปิด `FTR_FinishTime` ผ่าน `pending`, backfill ข้อมูลเก่า + ประกาศขั้นตอน apply migration, และให้ client เช็คผล release

## เอกสารเชื่อมโยง

[[01-system-map]] · [[02-bug-investigation]] · [[03-root-cause-and-fix-plan]] · [[05-regression-test-plan]] · [[06-execution-order]] · [[08-live-db-verification]]
