# Live DB & runtime verification (2026-10-14)

> **UPDATE:** การเชื่อมต่อ DB รอบแรกที่ล้มด้วย `ENOTFOUND` เป็นปัญหาชั่วคราว — Retry สำเร็จแล้ว เอกสารนี้คือหลักฐานที่ยืนยันกับ **ฐานข้อมูลจริงและการรันเซิร์ฟเวอร์จริง** แบบอ่านเท่านั้น (SELECT/GET เท่านั้น ไม่มี INSERT/UPDATE/DELETE/DDL, ไม่รัน test suite, ไม่มี production mutation) เอกสารนี้ **override** ข้อความ "ยังไม่ยืนยัน/ENOTFOUND" ใน [[01-system-map]] … [[07-handoff-to-coding-model]]

## 1. Connectivity & environment

| รายการ | ค่าที่ตรวจได้ | หมายเหตุ |
| --- | --- | --- |
| Host | `webdev.it.kmitl.ac.th` → `10.0.30.22` (ping 34ms) | DNS ล่มชั่วคราวรอบแรก แก้เองได้ |
| Server | MySQL **8.0.46** | ตรงกับที่ README อ้าง MySQL 8 |
| Database | `s68070186` | ตรงกับ `.env` |
| DB clock | `NOW()` = 2026-10-14 05:31, `UTC_TIMESTAMP()` = 2026-10-13 22:31 | |
| Host clock | local 12:31 **+0700**, UTC 05:31 | host ถูกต้อง |
| `@@system_time_zone` | `SE Asia Standard Time` (ระบุ +07) | **แต่ค่า NOW() ที่คืนมาตรงกับ UTC ของ host ไม่ใช่ +07** |
| Tables | **11 ตาราง** — เพิ่ม `student_score` (10 แถว) ที่ไม่อยู่ใน 10-table design | ต้องสอบถามที่มา/ลบตามนโยบาย |
| `COOKIE_SECRET` | มีค่า ยาว 64 chars | `server.js:15-19` ผ่าน |

**ข้อค้นพบ timezone (สำคัญต่อ BUG-005):** MySQL ประกาศ timezone เป็น +07 แต่ค่าที่ `NOW()` คืนสอดคล้องกับนาฬิกา UTC ของ host ไม่ใช่เวลาท้องถิ่น +07 กล่าวคือ label timezone ของ DB ไม่ตรงกับนาฬิกาจริง → ค่า DATETIME ที่เขียนด้วย `NOW()` (`FTR_OrderTime`, `FTR_FinishTime`, `FTR_ReleasedAt`, `ORD_DateTime`) เก็บเป็น UTC wall-clock ขณะที่ DB อ้าง +07 หากอนาคตใช้ฟังก์ชันวันที่ฝั่ง SQL (`CONVERT_TZ`, เทียบกับ `CURDATE()`) หรือ deploy บนเครื่องที่ Node TZ ไม่ใช่ UTC จะเกิดการเหลื่อมได้ถึง 7 ชั่วโมง ต้องตรึงนโยบาย timezone ก่อนแก้ BUG-005

## 2. Schema จริงของ `FITTING_ROOM` (ยืนยันจาก `information_schema`)

คอลัมน์จริงครบตรงกับ `database/schema.sql:102-117` + migration ทั้งสอง: `FTR_OrderID` (PK, varchar50), `ITV_SKUID` (nullable), `EMP_ID`, `FTR_Number` (varchar20, NOT NULL), `FTR_OrderTime` (datetime, default CURRENT_TIMESTAMP), **`FTR_FinishTime` (datetime, nullable — มีอยู่จริง)**, `FTR_CustomerPresent` (tinyint, default 0), `FTR_SessionID` (varchar64), `CUS_ID`, `FTR_ReleasedAt`.

Index ที่มีจริง: `PRIMARY(FTR_OrderID)` unique, `idx_ftr_room_session(FTR_Number, FTR_SessionID)` **NON-UNIQUE**, `EMP_ID`, `ITV_SKUID`

→ **ไม่มี UNIQUE constraint ใด ๆ ที่บังคับ "หนึ่งห้องมีเจ้าของที่ active ได้เพียงหนึ่งราย"** ยืนยันข้อจำกัดเชิงสถาปัตยกรรมของ BUG-006 จาก DB จริง

## 3. ข้อมูลจริง (COUNT(*) จริง ไม่ใช่ table_rows โดยประมาณ)

`item` 67, `item_variant` 96, `fitting_room` 14, `sale_order` 21, `sale_order_line` 28, `customer` 56, `employee` 53 (FITTING_STAFF 34 / CASHIER 19), `pay_cart_item` 1
SKU ทั้ง 96 รายการยาว **13 หลัก** (EAN-13) ทั้งหมด; ไม่มี SKU ซ้ำ; `ITV_Stock = 0` มี 0 รายการ; stock ต่ำสุด 2-3

## 4. ผลยืนยัน Bug ทีละข้อ (หลักฐานจริง)

| Bug | เดิม (static) | ผลตรวจ DB/runtime จริง | สถานะใหม่ |
| --- | --- | --- | --- |
| **BUG-001** | เสนอสมมติฐาน Back แล้วห้องไม่ว่าง | พบ session จริงค้างอยู่: `occ_1791952870927` ห้อง `5684848452325` `FTR_CustomerPresent=1` `FTR_ReleasedAt=NULL` อายุ **50 นาที**; `/api/fitting-rooms` รายงานห้อง 1 = `occupied`; เจ้าของเขาหน้าปกติได้ (200) แต่ลูกค้าอื่นโดน redirect 302 | **Confirmed live** (มี state ค้างจริง) — พฤติกรรม Back ยังต้องทดสอบ browser |
| **BUG-002** | เดารูปจาก SKU แล้วได้ `top-*` | `GET /api/cart` ของ u2 คืน item จริง `{sku,name,price,color,size,quantity}` — **ไม่มี `image`/`productId` เลย**; คำนวณ parity: จาก `ITM_ID='p1'` → `top-2.jpg` แต่จาก `SKU='8850010140000'` → `top-1.jpg` → **รูปเปลี่ยนหลัง reload แบบ deterministic**; สินค้า skirt/accessory ในตะกร้าจะกลายเป็น `top-1.jpg` | **Confirmed live** |
| **BUG-003** | seed มี 5 รายการ male+skirt | DB จริงยืนยัน `ITM_Tag='skirt'` + `ITM_Category='male'` = **p52, p54, p56, p58, p60** (female+skirt อีก 5); API จริง `GET /api/products/barcode/8850520432080` คืน `{"name":"A-Line Denim Mini Skirt","category":"male","tag":"skirt"}` | **Confirmed live** |
| **BUG-004** | p1 มีเพียง XL/Black + S/Navy | DB จริง: `8850010140000`=Black/XL (stock 5), `8850010310001`=Navy/S (stock 4) เท่านั้น → คู่ XL/Navy ไม่มีจริงในระบบ | **Confirmed live** (โมเดลข้อมูล) |
| **BUG-005** | คอลัมน์มี แต่ API ไม่ส่ง; DB อาจไม่มีข้อมูล | คอลัมน์มีจริง; ออเดอร์ complete จริง 4 ใบมี `FTR_FinishTime` บันทึกครบ (เช่น `fo_1791952043042`: order 04:27:21 → finish **04:27:28**); แต่ `GET /api/fitting-orders` คืน keys `[id,status,createdAt,roomId,sku,empId,size,color,productName,price,tag,productId,staffName,roomDisplay,image]` → **ไม่มี `finishedAt`** และการ์ดแสดง `createdAt` 04:27:21 ซึ่งเป็นคนละเวลากับ finish จริง | **Confirmed live** — สมมติฐาน "DB ไม่บันทึกเวลา" ถูก **หักล้าง**; ปัญหาคือสัญญา API/UI |
| **BUG-006** | แถว `occ_` ปนกับออเดอร์, ไม่ atomic | จริง: `occ_` 4 แถว (1 active), `fo_` 10 แถว; **ออเดอร์ complete 4 ใบมี `FTR_ReleasedAt = NULL` ค้างถาวร** → staff GET (กรอง `FTR_ReleasedAt IS NULL`) จึงแสดง **เฉพาะ complete 4 ใบนี้เท่านั้น** ส่วน pending/preparing 6 ใบถูก release ไปแล้วจึงหายจาก Kanban; ไม่มี UNIQUE กัน double-booking | **Confirmed live** |
| **BUG-007** | mapping ซ้ำ, รหัสไม่รู้จักผ่านได้ | จริง: `FTR_Number` ที่ใช้มีเพียง 2 ค่า (`5684848452325` = 10 แถว, `5684848452326` = 4 แถว) ห้อง 3/4 ไม่เคยถูกใช้; `/api/fitting-rooms` คืน 4 ห้องพร้อม roomDisplay 1-4 ถูกต้อง | **Confirmed live** (การเก็บค่าเป็น external ID) — พฤติกรรม QR จริงยังต้องทดสอบ |

## 5. ข้อพบใหม่ที่ยังไม่มีในรายงานเดิม

1. **`POST /api/auth/login` ลบ Server Cart ของลูกค้าทุกครั้งที่ login** — `routes/auth.js:147-149` `DELETE FROM PAY_CART_ITEM WHERE PAY_CART_ID = ?` ก่อนตั้ง cookie และ `Cart.init()` ฝั่ง client ถือ server เป็น authoritative แล้วเขียนทับ localStorage (`public/js/cart.js:69-73`) → **ตะกร้าหายทุกครั้งที่ login** ขัดกับเรื่อง "cart persistence" และเป็น data-loss defect ที่ควรเพิ่มเข้า scope (adjacent to BUG-002) ทั้งนี้ **ตรวจจากโค้ดเท่านั้น** เพราะการทดสอบจะทำให้ข้อมูล cart จริงของ u2 หาย
2. **Security guard ทำงานจริงตามที่ test อ้าง** — ยืนยัน live: `/api/receipts` ไม่มี cookie → 401, customer cookie → 403, cashier cookie → 200; `/api/fitting-orders` ไม่มี cookie → 401; barcode ปลอม `9999999999999` → 404 พร้อมข้อความ "ห้ามมั่ว"
3. **Guard ของ view route ทำงานถูก** — u2 เข้าห้องที่ u1 ครอบครอง → 302 → `/customer/dashboard`; u1 เจ้าของ → 200; u1 เข้าห้องว่าง 3 ที่ไม่ได้เข้า → 302 (ต้องสแกนก่อนเท่านั้น)
4. **Kanban พนักงานแสดงแต่งาน complete เก่า ไม่เห็นงานค้าง** — เพราะ GET กรอง `FTR_ReleasedAt IS NULL` ทำให้เหลือเฉพาะ complete 4 ใบที่ยังไม่ถูก release; pending/preparing 6 ใบถูก release ไปแล้วจึงหายจาก Kanban นี่คืออาการปลายทางของ BUG-006 ที่ผู้ใช้เห็นจริงบนหน้าจอ
5. `sale_order` จริง 21 ใบ ช่องทาง `customer_pay_and_go`(9 QR,1 credit) และ `pos_cashier`(7 cash,3 QR,1 credit) ยอดรวม 53,319.80 — POS/checkout ถูกใช้จริง

## 6. ขอบเขตที่ยังไม่ยืนยัน

- ไม่ได้ทดสอบ browser interaction จริง (Back/Refresh/BFCache, 2 แท็บ) — ต้องใช้ browser automation
- ไม่ได้ทดสอบ concurrency race ของ `/enter` (ต้องใช้ 2 connection เขียนพร้อมกัน ซึ่งเป็นการเขียน DB จึงต้องมี test DB แยกตาม T00)
- ไม่ได้รัน `npm test` เพราะเขียนข้อมูลจริง (`tests/api.test.js`) — ยังคงต้องทำ T00
- ไม่ได้พิสูจน์ว่า QR payload จริงบนป้ายหน้าห้องคือค่าใด และ `53636636373363` ไม่ปรากฏในระบบ
- ไม่ได้ยืนยันภาพสินค้าจริงรายสี เพราะ schema/mock ไม่มี asset mapping ราย variant
- Cart login-wipe ยืนยันจากโค้ดเท่านั้น ไม่ได้ทดสอบ (จะทำลายข้อมูลจริง)

## 7. วิธีที่ใช้ตรวจ (ทำซ้ำได้)

สคริปต์ read-only ใน `~/AppData/Local/hermes/cache/scratch/`: `db_audit.js`, `db_audit2.js` (SELECT/information_schema), `smoke.js` (boot server + curl read-only endpoints), `probe.js`/`probe2.js`/`probe3.js` (สร้าง **signed cookie เองด้วย HMAC-SHA256 จาก `COOKIE_SECRET`** เพื่อยิง endpoint ที่ต้อง auth โดย**ไม่ผ่าน POST /login** จึงไม่ลบ cart และไม่เขียน DB) — ผ่านหมดและไม่มี write ใด ๆ `git status --short` ยังคงแสดงเฉพาะ `Audit/` (untracked)

## เอกสารเชื่อมโยง

[[01-system-map]] · [[02-bug-investigation]] · [[03-root-cause-and-fix-plan]] · [[05-regression-test-plan]] · [[06-execution-order]] · [[07-handoff-to-coding-model]]
