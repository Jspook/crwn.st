# crwn.st — แผนรวม: คำเตือนสินค้าค้างส่งไม่ขึ้น + คำขอเก่ากลับมาใน Kanban

> **สถานะ:** รออนุมัติแผนทั้งสองบั๊ก · ยังไม่แก้ source/schema/data และยังไม่รัน test สำหรับสองบั๊กนี้ · Source trace ที่ HEAD `01e426d04a062a40cd91be1797e61dcb16d43772` (`main...origin/main`; ไม่มี dirty paths ตอนตรวจ)

ไฟล์นี้เป็น **แผนเดียวสำหรับสองบั๊ก**: A คำเตือนสินค้ายังไม่ถูกนำส่งไม่แสดงก่อนลูกค้าออกจากห้อง; B คำขอที่ยังไม่รับกลับมาใน Kanban เมื่อห้องถูกใช้งานใหม่. ทั้งสองกระทบ flow ออกจากห้อง แต่มี root cause ต่างกันและต้องมี regression test แยก ก่อนทดสอบร่วมกัน.

## A — คำเตือนสินค้าค้างส่งไม่แสดงก่อนออก

### อาการและสาเหตุที่ตรวจจากโค้ด

ลูกค้ามีสินค้าที่ยังไม่ถูกนำส่ง (pending/preparing) แล้วกดออกจากห้อง แต่ไม่เห็นรายการแจ้งเตือนแบบเดิม. **Confirmed (code), ยังไม่ใช่ live E2E:** migration เปลี่ยน `FTR_Number` ให้เป็นหมายเลขห้อง (`database/migrations/20261014_room_schema_and_numbers.sql:11-21`); INSERT บันทึก `room.roomNumber` (`routes/api.js:643-646`) แต่หน้า customer เรียก GET ด้วย `currentRoomId` ซึ่งเป็น barcode (`views/customer/fitting-room.ejs:168-170,261-265`) ขณะที่ GET ยังนำ barcode ไปกรอง `FTR_Number` (`routes/api.js:393-398`). ตัวอย่าง read-only resolver ที่บันทึกใน [[01-undelivered-warning]]: INSERT=`1` แต่ GET ส่ง barcode=`5684848452325` จึงไม่ตรงกัน. เมื่อ GET ได้ `[]` client เข้า no-orders native confirm แทน modal รายการค้างส่ง (`views/customer/fitting-room.ejs:277-292,356-377`). อีกเส้นทางหนึ่ง client จับ fetch/HTTP error แล้วแปลงเป็น `[]` (`:261-270`) ซึ่งอาจซ่อนคำเตือนเช่นกัน แต่ **ยังไม่ยืนยันว่าเกิด error จริง** ในกรณีผู้ใช้รายงาน. ต้องตรวจ live schema/data/UI ก่อนอ้างว่า production มีแถวแบบใด.

### ขั้นแก้และเกณฑ์รับงาน A (รออนุมัติ)

| ID | งาน | เกณฑ์ตรวจรับ |
| --- | --- | --- |
| A01 | RED test บน mock/isolated target: สร้างคำขอในห้อง `1` แล้ว GET ด้วย barcode ของห้องเดียวกันและ alias `1`; ตรวจสิทธิ์ลูกค้า/session; ทดสอบ pending, preparing, complete, ห้องว่าง, GET error และ exit UI. | ก่อนแก้ test ที่มีคำขอค้างส่งต้อง fail เพราะดึงรายการไม่พบ; ไม่มีการเขียน shared DB. |
| A02 | Normalize identifier ใน GET ให้ตรงกับค่า canonical room number ที่ INSERT เก็บ; ถ้าพบ legacy barcode ใน live DB แบบ read-only ให้ออกแบบ compatibility เฉพาะที่จำเป็น ไม่เดาสภาพข้อมูล. คง access control ที่ผูก occupancy/customer/session; อย่าใช้เลขห้องอย่างเดียวเพื่อดึงงานข้าม session (ใช้ session guard ใน B). | GET ด้วย barcode/alias ของห้องเดียวกันคืนเฉพาะรายการ active session; ห้องอื่นหรือผู้ใช้ไม่มีสิทธิ์ไม่เห็นข้อมูล. |
| A03 | แยก no-orders (`200 []`) จาก HTTP/network failure: failure ต้อง fail closed (แจ้งตรวจสอบไม่ได้และไม่ปล่อยออกผ่าน no-orders path), pending/preparing ต้องเปิดคำเตือนพร้อมรายการ; ยืนยันว่า cancel ไม่ release และ confirm release ตาม flow เดิม. | UI ไม่บอกว่าไม่มีงานเมื่อ API ล้มเหลว; คำเตือนขึ้นก่อนออกสำหรับรายการที่ยังไม่นำส่ง; complete-only ไม่เตือนผิด. |
| A04 | GREEN tests และตรวจ browser + HTTP บน isolated test DB; ถ้าทำ read-only live probe ให้ตรวจ schema/แถวที่เกี่ยวข้องโดยไม่สร้างคำขอใหม่ และบันทึก evidence แยก tier. | มีหลักฐาน RED→GREEN และผล UI/HTTP ที่ตรวจจริง; ไม่อ้าง live E2E หากไม่ได้ทำ. |

## B — คำขอเก่ากลับมาเมื่อเข้าห้องใหม่

### เป้าหมายและหลักฐาน

Scenario: ลูกค้าสร้างคำขอลองสินค้า → พนักงานยังไม่รับ (`EMP_ID IS NULL`) → ลูกค้าออกจากห้อง → งานหายจาก Kanban → ลูกค้าคนเดิมหรือคนอื่นเข้าห้องเดิมอีกครั้ง → **คำขอเก่าต้องไม่กลับเป็นงานใหม่ และต้องกดรับไม่ได้**. การกลับเข้าห้องโดยยังไม่ release คือ resume session เดิมและต้องยังเห็นคำขอเดิมตามสถานะ.

**ยืนยันจาก source ไม่ใช่ live E2E:** `routes/api.js:584-591,643-646` อ่าน `sessionId` จาก occupancy แต่ INSERT เก็บเพียงห้องและ `CUS_ID` ไม่เก็บ session; `routes/api.js:531-555` และ `utils/roomOccupancy.js:55-70` release occupancy ใน memory แต่ไม่เปลี่ยนแถวคำขอ; `routes/api.js:357-443` อ่านแถวแล้วกรองว่าห้องมีคนอยู่ ไม่ตรวจว่าแถวเป็นของ session ปัจจุบัน; `views/staff/fitting.ejs:91-96,119-135` แสดงรายการจาก API. `utils/roomOccupancy.js:38-53` สร้าง session ใหม่เมื่อห้องว่าง. `database/migrations/20261014_room_schema_and_numbers.sql:23-30` เคยลบ `FTR_SessionID`; `database/schema.sql:103-114` ปัจจุบันไม่มี session/cancel fields. จึงเป็น **code-path defect**; ยังไม่อ้างว่าพิสูจน์ข้อมูลใน live DB หรือ UI จริง.

### แผนการแก้ B (ต้องได้รับอนุมัติก่อน B01–B06)

| ขั้น | งานและจุดเปลี่ยน | ผลที่ต้องได้ |
| --- | --- | --- |
| B01 ตรวจสภาพ | ยืนยัน `git status --short --branch` และ HEAD อีกครั้ง; ไม่แตะไฟล์ที่ dirty มาก่อน. ตรวจ live schema/จำนวนแถว legacy แบบ read-only หากอนุญาตให้เข้าถึง; ตรวจทุก test file ก่อนรัน (รวมไฟล์ใน `tests/` ที่ `npm test` อ้าง). | ทราบ drift ของ schema, migration, test target และแถว `NULL` ก่อนออกแบบ migration จริง; ไม่มี DB write. |
| B02 RED regression | เพิ่ม test เฉพาะจุดด้วย mock/in-memory DB สำหรับ enter → create → release → re-enter และ staff GET/PATCH; ทดสอบ failure/race. ยังไม่ใช้ live DB. | RED ด้วยเหตุที่คำขอเก่าปรากฏ/รับได้ ไม่ใช่ test harness พัง. |
| B03 Session identity + lifecycle | เพิ่ม migration แบบ additive สำหรับ `FITTING_ROOM.FTR_SessionID` และ `FTR_CancelledAt` (หรือสถานะ terminal ที่สื่อความหมายเทียบเท่า) พร้อม index ที่เหมาะกับ room/session/status; อัปเดต `database/schema.sql` ให้ตรง migration. INSERT ต้องบันทึก session ที่ตรวจสิทธิ์แล้ว; เลือกแนวทางจัดการ legacy rows `NULL` โดยไม่ backfill เป็น active session และไม่ DELETE. | เก็บ session ที่สร้างคำขอและเหตุที่ pending ถูกยกเลิกแบบตรวจย้อนหลังได้; schema ใหม่ต้องผ่าน review ก่อน apply DB จริง. |
| B04 Release + expiry | เมื่อ release สำเร็จ ให้ยกเลิก **เฉพาะ pending ของ session ที่กำลังออก** (`EMP_ID IS NULL`, ยังไม่ complete/cancelled) โดยเก็บแถว; staff force-release ใช้ session ที่ active จริง. ออกแบบลำดับ DB mutation กับ occupancy release ให้ retry ได้และไม่คืน success ครึ่งทาง; synchronize ต่อห้องหรือใช้ transaction/conditional update เพื่อปิด race create/release. TTL expiration (`utils/roomOccupancy.js:26-35,84-93`) และ process restart ต้องไม่ทำให้ session เก่ากลายเป็น active อีก; หากต้องการสถานะ cancelled ครบแม้หมดอายุโดยไม่มี request ใหม่ ให้กำหนด reconciliation ที่ทน restart ก่อน implement. | ไม่มี pending ของ session ที่จบหลงเหลือเป็นงานปัจจุบัน; DB error ไม่รายงาน release success โดยที่การปิดงานล้มเหลว. |
| B05 Read + transition guard | `GET /api/fitting-orders` ทั้ง staff และ customer กรองด้วย session ของห้องที่ active **เทียบกับแถว** และไม่แสดง cancelled; ไม่ใช้ occupancy เพียงว่าห้องมีคน. `PATCH /api/fitting-orders/:id` ต้องตรวจ active session, cancelled state, staff ownership และ transition ที่อนุญาต; อัปเดตแบบ conditional แล้วตรวจ affected rows เพื่อกัน stale action/TOCTOU. Client Kanban ควรพึ่ง API ที่ถูกต้อง ไม่ซ่อนบั๊กด้วย UI filter. | ลูกค้าคนเดิม/คนอื่นไม่เห็นหรือกดรับคำขอเก่า แม้เรียก API ตรง/ถือ card เก่าไว้. |
| B06 GREEN + acceptance | รัน test ที่ผ่าน safety gate, static checks และ isolated E2E พร้อมหลักฐาน HTTP/UI/DB ของ test database; ตรวจ `git diff --check` และ diff จำกัดเฉพาะไฟล์ที่อนุมัติ. | มีผล RED→GREEN และร่องรอยการตรวจจริง; ไม่อ้าง live production verification หากไม่ได้ทำ. |

### Cases ที่ต้องทดสอบ

- ลูกค้า A สั่ง pending ใน session S1 → ออก → GET Kanban ไม่เห็น → A เข้าใหม่ S2 แล้วไม่เห็น S1; สร้างคำขอ S2 แล้วเห็นเฉพาะ S2.
- ลูกค้า B เข้า **ห้องเดียวกัน** หลัง A ออก → ไม่เห็น S1; staff ยิง PATCH รับ S1 ด้วย ID เดิม ต้องถูกปฏิเสธและ DB ไม่เปลี่ยน.
- Resume ของ A โดยยังไม่ออก → session ID เดิมและคำขอเดิมยังอยู่; release ด้วย session ผิดต้องไม่ยกเลิกอะไร; staff force-release ยกเลิก pending ของ session ที่ถูกปล่อยเท่านั้น.
- คำขอ `preparing`/`complete` เดิมไม่ถูกเปลี่ยนเป็น cancelled โดย cleanup ของ pending แต่ต้องไม่กลับเข้า Kanban ของ session ใหม่; ต้องกำหนดหน้าประวัติแยกหากธุรกิจต้องการดูงานที่กำลังทำหลังออก.
- การสร้างคำขอระหว่าง release, staff PATCH ระหว่าง release, request ซ้ำ, DB failure และการ retry ไม่ทิ้งคำขอที่รับได้แต่ไม่มี active session.
- TTL expiry และ restart: session เดิมไม่ปรากฏหรือถูก PATCH ได้เมื่อห้องถูก acquire ใหม่; ตรวจนโยบาย reconciliation/cancellation ให้ตรงกับ acceptance.
- แถวเก่า `FTR_SessionID IS NULL` ต้องไม่ถูกเหมารวมกับ session ใหม่; เก็บข้อมูลไว้และตรวจจำนวน/แนวทางย้ายข้อมูลแยก ไม่สร้างคำสั่ง destructive migration โดยอัตโนมัติ.

### Safety gate ก่อน test หรือ migration

- อ่าน **ทุกไฟล์ที่คำสั่งทดสอบจะรัน** (`package.json` ระบุ `tests/roomResolver.test.js`, `tests/roomOccupancy.test.js`, `tests/fitting-room-view.test.js`, `tests/room-ui.test.js`, `tests/audit-regression.test.js`, `test/room-exit.test.js`; `test:integration` ใช้ `tests/api.test.js`) รวม helper, `database/db.js`, env/mode และทุก setup/teardown เพื่อพิสูจน์ว่าไม่มีการเขียน shared datastore/service. `test/room-exit.test.js:11-16` ตั้ง `USE_MOCK_DB=true` แต่ **ไม่เพียงพอ** สำหรับรับรองทั้ง suite; `tests/` อยู่ใน `.gitignore` และอาจไม่มีบน fresh clone.
- หาก target เป็น shared DB, ต้อง seed/reset, หรือแยก isolated datastore ไม่ได้: **ไม่รัน**; บันทึก command ที่ถูกระงับพร้อมเหตุผล. ห้ามเรียก seed/setup/live migration กับฐานจริงในขั้นทดสอบ. Test DB/E2E ที่เขียนข้อมูลต้องขออนุมัติ scope ต่างหาก.
- ก่อน apply migration จริงให้ review schema diff, ผล read-only inventory, แผน backup/rollback และ downtime/lock implications; ห้ามรัน migration ในรอบนี้.

## ขอบเขตและจุดตัดสินใจ

1. แผนนี้เสนอ **additive schema change** เพราะ room number ไม่ใช่ session identity และ migration เดิมได้ลบ field นี้ไปแล้ว; ไม่ควรแก้ด้วยการซ่อน card ที่ UI หรือเทียบ timestamp อย่างเดียว.
2. Policy ที่เสนอ: pending ถูก cancel เมื่อ release; preparing/complete เป็นประวัติแต่ไม่แสดงใน feed ของ session ใหม่. ต้องยืนยันความต้องการธุรกิจเรื่องงานที่ staff รับแล้วแต่ลูกค้าออกก่อน ก่อนกำหนด transition เพิ่ม.
3. Occupancy อยู่ใน memory (restart ปล่อยห้องทั้งหมด) ขณะที่คำขออยู่ใน MySQL; ต้องตัดสินว่าจะใช้ DB session registry/expiry reconciler หรือใช้ session-key isolation + reconciliation แบบจำกัด. ห้ามอ้างว่าการเพิ่ม `FTR_CancelledAt` อย่างเดียวแก้ทุก failure mode.
4. บั๊ก A และ B อยู่ใน **ไฟล์แผนเดียวกัน** แต่ต้องแยก RED tests ตามสาเหตุ และใช้ flow ร่วมเพื่อกัน regression: pending ของ S1 ต้องเตือนก่อนยืนยันออก; กด cancel ต้องคง session/งานไว้; ยืนยันออกจึงปิด session/ยกเลิก pending; เข้าใหม่ S2 แล้วต้องไม่เตือนหรือเห็นคำขอ S1; คำขอใหม่ใน S2 ต้องเตือนก่อนออกตามปกติ.
5. ลำดับ implement ที่เสนอ: safety gate/RED (A01+B01+B02) → session-aware read/write (B03+B05) กับ room identifier normalization (A02) → lifecycle release (B04) → exit UI fail-closed (A03) → GREEN/E2E (A04+B06). ต้องออกแบบ pre-release warning ให้ query pending ของ **session ปัจจุบันก่อน cancel** ไม่ใช่หลัง cleanup; release ที่ DB ล้มเหลวห้ามให้ UI แสดงว่าออกสำเร็จ.

## สิ่งที่ยังไม่ยืนยันและเหตุผล

- Live schema, legacy rows (`FTR_Number` barcode หรือเลขห้อง, `FTR_SessionID`), deployed behavior, network errors และ browser UI ยังไม่ตรวจในรอบแผน; ห้ามยก source trace เป็น live proof.
- ยังไม่ยืนยัน test suite ทุกไฟล์ว่าปลอดภัยต่อ shared DB จึงยังไม่รันทดสอบ; isolated E2E ต้องมี DB แยกและ approval ของ scope การเขียน.
- **Task IDs รออนุมัติ:** A01–A04 และ B01–B06. ไม่มี source/schema/data change ในรอบนี้.
- `Audit/` ถูก `.gitignore:6` ignore: ไฟล์แผนและรายงานเดิมอยู่ในเครื่องนี้ แต่ไม่ติด Git ตามปกติ; ต้องกำหนดวิธีนำเข้า Git ต่างหากหากต้องการ sync.

## เอกสารเชื่อมโยง

- [[01-undelivered-warning]] — รายงานหลักฐาน code-path เดิมของบั๊ก A (เก็บไว้ ไม่ใช่ไฟล์แผนอีกชุด).
- [[2026-10-14 Room Exit Regression]] — การส่ง session ID และ retry release ที่เคยแก้; ไม่ใช่หลักฐาน E2E ของบั๊กนี้.
- Source: `routes/api.js`, `utils/roomOccupancy.js`, `views/staff/fitting.ejs`, `database/schema.sql`, `database/migrations/20261014_room_schema_and_numbers.sql`, `package.json`.
