# crwn.st — แจ้งเตือนสินค้าค้างส่งเมื่อออกจากห้องลอง

> **สถานะ:** สืบสวนแบบอ่านอย่างเดียว; ยังไม่แก้โค้ด/ข้อมูล · HEAD `01e426d04a062a40cd91be1797e61dcb16d43772` · `git status --short --branch`: `## main...origin/main` (ไม่มี dirty paths ก่อนเขียนรายงาน)

## อาการและระดับหลักฐาน

**Confirmed (code):** หลัง migration ที่ normalize `FTR_Number` จาก barcode เป็นหมายเลขห้อง `1`–`10` (`database/migrations/20261014_room_schema_and_numbers.sql:11-21`), การสร้างคำขอลองเก็บ `room.roomNumber` (`routes/api.js:571-580,643-646`) แต่ GET ที่หน้าออกจากห้องเรียกด้วย `currentRoomId` ซึ่งเป็น barcode (`views/customer/fitting-room.ejs:168-170,261-265`) และ SQL ยังค้น `FTR_Number` ด้วย barcode สองครั้ง (`routes/api.js:393-398`). สำหรับห้อง 1 ตัวอย่างจาก `resolveRoom` จริง: insert=`1`, GET parameters=`["5684848452325","5684848452325"]`; ไม่มี parameter ตรงกับค่าที่ insert. คำสั่ง Node read-only ที่รันให้ผล `matchesInserted:false`. ความไม่ตรงกันนี้อยู่ใน commit `120b76d` ที่เพิ่ม migration/เปลี่ยน insert แต่ปล่อยตัวกรอง GET เหมือน parent commit.

**Confirmed (code):** เมื่อ GET คืน `[]`, หน้าเว็บเข้าทาง `roomOrders.length === 0` และแสดงเพียง native confirm ออกจากห้อง (`views/customer/fitting-room.ejs:277-286`), ไม่เปิด modal ที่ `renderExitItemsList()` จะแสดงรายการค้างส่ง (`:288-292,356-377`). อีกทางหนึ่ง ถ้า GET HTTP ไม่สำเร็จหรือ throw, client กลืน error และใช้ `[]` เช่นกัน (`:261-270`) — เป็นสาเหตุทางเลือกระดับ **Likely** หาก runtime API มี error; ยังไม่ยืนยันว่าเกิดจริงในกรณีที่รายงาน.

**ขอบเขต:** การเปรียบเทียบนี้พิสูจน์ code-path ของคำขอใหม่ที่บันทึกหมายเลขห้องและเปิดหน้าด้วย barcode (`routes/views.js:90-97,138-147`) ไม่ใช่หลักฐานว่า production มีแถวใด หรือว่า browser ปัจจุบันแสดงผลแบบนั้น. ข้อมูล live ใน [[08-live-db-verification]] ถูกเก็บก่อน migration จึงไม่ใช้ยืนยันสถานะ DB วันนี้. `FTR_Number` ใน schema เป็น `VARCHAR(20)` (`database/schema.sql:107`), จึงไม่ใช่ประเด็น numeric coercion.

## แผนเสนออนุมัติ (ยังไม่ implement)

- **T01 — Regression test แบบ isolated/mock (RED):** GET `/api/fitting-orders?roomId=5684848452325` ด้วย session ของลูกค้าเดียวกันหลัง insert ห้อง `1` ต้องคืน pending; GET ด้วย alias `1` ก็ต้องคืนรายการเดียวกัน; ผู้ใช้อื่น/ไม่มี occupancy ต้องไม่เห็น. ทดสอบว่าหน้า exit แสดงคำเตือน pending/preparing และไม่ตีความ HTTP error เป็นห้องที่ไม่เคยมีคำขอ. ก่อนรัน suite อ่านทุก test file และยืนยันไม่มีการเขียน DB จริง; `tests/` ถูก ignore และ `npm test` อ้างไฟล์ในนั้น — ทดสอบบน fresh clone อาจหาไฟล์ไม่พบ.
- **T02 — Minimal fix:** normalize ค่าในตัวกรอง GET ให้ครอบคลุมหมายเลขห้องที่ DB เก็บ (รวม barcode เก่าถ้ามีข้อมูล legacy จริง) โดยคง access control; ปรับ fetch failure ให้ fail closed แทนการแสดง no-orders confirmation. อย่าแก้ schema/DB จนกว่าจะตรวจ live schema และอนุมัติ.
- **T03 — Verification:** รัน RED→GREEN บน mock target, suite ที่พิสูจน์ว่าปลอดภัย, จากนั้น browser + read-only DB/HTTP probes โดยเก็บ before/after row counts; ทดสอบ pending, preparing, complete, ห้องว่าง และ error response. การยืนยัน end-to-end ด้วยการสร้างออเดอร์ใหม่ต้องใช้ isolated test DB และอนุมัติแยก.

**Task IDs awaiting approval:** T01, T02, T03. ไม่มีการแก้โค้ด/schema/data หรือรัน test suite รอบนี้. รายงานนี้อยู่ใน `Audit/` ซึ่ง `.gitignore:6` ignore จึงคงอยู่เฉพาะเครื่องนี้และไม่ติด Git ตามปกติ.

## สิ่งที่ยังไม่ยืนยันและเหตุผล

- Live DB schema, ค่าจริงของ `FTR_Number`, สถานะ deployment/migration, HTTP response และ UI จริง: ยังไม่ได้เปิด connection/session ในการสืบสวนนี้.
- Browser กรณี pending/preparing และ failure path: ยังไม่ได้จำลอง session/คำขอใน isolated DB; หลีกเลี่ยง write ต่อ shared database.
- จำนวนคำขอเก่าที่ barcode กับใหม่ที่ room number ปะปนกัน และการแยกคำขอตาม session หลัง re-occupy: ต้องตรวจ live read-only เพิ่ม; schema ล่าสุดไม่มี `FTR_SessionID` จึงควรประเมินเป็นประเด็นแยก ไม่สรุปจาก defect นี้.

## เอกสารเชื่อมโยง

- [[2026-10-14 Room Exit Regression]] — ปัญหา release ไม่สำเร็จคนละกรณี; ไม่ใช่หลักฐานว่าคำเตือนค้างส่งถูกทดสอบแล้ว.
- [[08-live-db-verification]] — snapshot ก่อน normalization; ห้ามนำไปใช้เป็น live proof ปัจจุบัน.
- Source: `routes/api.js`, `views/customer/fitting-room.ejs`, `utils/roomResolver.js`, `database/migrations/20261014_room_schema_and_numbers.sql`.
