# crwn.st — แผนงานและสถานะ 15/10/2026: คำเตือนก่อนออกห้องและคำขอเก่ากลับเข้า Kanban

> **ขอบเขต:** บั๊ก A — คำเตือนสินค้าค้างส่งก่อนออกห้องลอง; บั๊ก B — คำขอของ session เก่ากลับมาใน Staff Kanban / ถูกเปลี่ยนสถานะเมื่อมี session ใหม่  
> **ฐานอ้างอิง:** `main` ที่ HEAD `01e426d` ตาม `git status --short --branch` และ `git rev-parse --short HEAD` รอบจัดทำเอกสารนี้; working tree **ยังมีการแก้ไขที่ไม่ commit**  
> **สถานะโดยรวม:** implementation อยู่ระหว่างตรวจและทดสอบ; **ยังไม่ยืนยันว่าแก้บั๊กสำเร็จในระบบจริง**

## สิ่งที่ทำไปแล้ว

- จัดทำแผนรวมสองบั๊กก่อนเริ่มแก้ใน [[2026-10-14 Pending Order Reentry Plan]] พร้อมรายงาน [[01-preflight-and-safety-report]] และ [[02-architecture-and-api-contract]]. ผู้ใช้อนุมัติ policy: release ยกเลิกเฉพาะ `pending` ของ session ที่จบ; เก็บ `preparing`/`complete` เป็นประวัติ; ไม่ backfill legacy rows อัตโนมัติ; customer release ต้องระบุ session. การอนุมัตินี้ **ไม่ใช่** อนุญาตให้เขียน shared DB.
- Source trace ระบุความเสี่ยงบั๊ก A จากความไม่ตรงกันระหว่าง barcode ที่ client ส่งกับหมายเลขห้องที่บันทึกใน `FTR_Number`; บั๊ก B จากคำขอที่เดิมไม่ผูก session กับการเก็บ occupancy ใน memory. เป็นหลักฐานระดับ source ไม่ใช่ production E2E.
- เพิ่ม/แก้ไฟล์ใน working tree: `views/customer/fitting-room.ejs` และ `test/customer-exit-warning.test.js` สำหรับคำเตือนและ fail-closed เมื่อ GET ล้มเหลว; `test/fitting-order-room-alias.test.js` สำหรับ room alias; `utils/fittingSessions.js` และ `test/fitting-session-lifecycle.test.js` สำหรับ durable session lifecycle; `routes/api.js`, `routes/views.js` สำหรับ GET/POST/PATCH, enter/release และ view gate ที่อ้าง active session; `database/schema.sql` และ `database/migrations/20261015_durable_fitting_sessions.sql` สำหรับ schema/migration แบบ additive. **ไฟล์ migration ยังไม่ได้ apply.**
- Read-only DB probe ก่อนหน้านี้พบ `FITTING_ROOM` 6 แถว, pending ตาม predicate เดิม 2 แถว และยังไม่มี `FTR_SessionID`/`FTR_CancelledAt` ณ เวลาตรวจ; ไม่ใช่หลักฐานว่า schema ปัจจุบันถูก migrate แล้ว.
- รอบจัดทำเอกสารนี้ `node --check` ผ่านสำหรับ `routes/api.js`, `routes/views.js`, `utils/fittingSessions.js` และ `git diff --check` exit 0. สิ่งนี้ยืนยันเพียง syntax/whitespace ของไฟล์ที่ตรวจ **ไม่ใช่** functional pass.

## สิ่งที่กำลังทำ / ต้องตรวจให้จบก่อนบอกว่าเสร็จ

1. Review diff จริงของ `routes/api.js` และ `routes/views.js`: ตรวจสิทธิ์ customer/staff, session/room identity, status transition, race ระหว่าง INSERT/PATCH/release และผลตอบกลับเมื่อ DB ล้มเหลว. โดยเฉพาะ staff PATCH ที่เพิ่งผูก `withLockedActive` และ guard stale order ยังไม่ได้รับรองด้วย regression test รอบล่าสุด.
2. เทียบ SQL ใน `utils/fittingSessions.js`, `database/schema.sql` และ migration กับ schema จริงแบบ read-only; ตรวจ legacy barcode rows, FK/index, lock order, TTL และ expiry/restart. ห้ามถือว่า mock test พิสูจน์ MySQL locking หรือ migration.
3. ตรวจ regression test ใหม่และของเดิมให้ตรง contract ที่เปลี่ยนจาก in-memory occupancy เป็น durable DB session; อ่านทุก test และ test setup/teardown รวมถึง datastore target **ก่อนรัน**. ผลการเรียก test ก่อนหน้านี้บางรอบไม่มี output ที่อ่านยืนยันได้ จึง **ยังไม่รายงานจำนวนที่ผ่าน** หรืออ้าง GREEN หลัง patch ล่าสุด.
4. ตรวจการติดตามไฟล์: `Audit/` ถูก `.gitignore` ignore; `test/` ใหม่มีไฟล์ untracked และ `test/customer-exit-warning.test.js` อยู่สถานะ staged added. ต้องแยกการมีไฟล์ในเครื่องออกจากการ sync ผ่าน Git.

## สิ่งที่จะทำ — ลำดับและเกณฑ์หยุด

| ลำดับ | งาน | หลักฐาน/เกณฑ์จบ |
| --- | --- | --- |
| 1 | Review source diff + migration และแก้เฉพาะข้อบกพร่องที่พบ โดยไม่แตะ shared data | SQL, authorization, stale-action guard, release semantics ตรง policy; `git diff --check` และ syntax check ผ่าน |
| 2 | รัน mock-only regression หลัง safety review: Bug A exit warning/room alias, Bug B lifecycle และ API GET/POST/PATCH; ตรวจผล RED/GREEN เท่าที่มีหลักฐานจริง | เก็บ command, exit code และ pass/fail ที่อ่านได้; failure ต้องวิเคราะห์และแก้ ไม่ตีความว่า GREEN |
| 3 | ตรวจสถานการณ์ end-to-end บน **isolated test DB ที่พิสูจน์แล้วเท่านั้น**: S1 pending → เตือนก่อนออก → cancel คง session → ยืนยันออก → S2 ไม่เห็น/รับ S1 ไม่ได้; preparing/complete คงประวัติ; ทดสอบ expiry/restart และ failure | HTTP/UI/DB evidence แยกจาก mock; ตรวจว่า migration apply กับ DB แยกจริงก่อนทดสอบ |
| 4 | Review backup/rollback และผล lock ของ migration ก่อน apply; ถ้าไม่มี isolated DB ให้ค้างขั้นนี้ไว้ | **ไม่รัน** `npm run test:integration` หรือ migration กับ shared/live DB; รายงาน blocker และ command ที่งดรัน |
| 5 | สรุปผลและ Git state เพื่อส่งมอบ | ระบุไฟล์, test ที่รันจริง, test ที่งด, ข้อจำกัด และไม่อ้าง production fix หากยังไม่ deploy/verify |

## Safety gate และขอบเขตคำกล่าว

- ณ รอบนี้ยัง **ไม่มีหลักฐาน** ว่า isolated DB พร้อมใช้งาน, migration ถูก apply, browser E2E ผ่าน, หรือ production behavior ถูกยืนยัน. ไม่แก้ข้อมูลจริงเพื่อเร่งผลทดสอบ.
- หากพบ shared DB target, schema drift หรือ business policy ที่ยังไม่ชัด ให้หยุดเฉพาะขั้นที่ได้รับผลกระทบและขอการตัดสินใจ; ไม่ข้ามข้อจำกัดด้วย mock result.
- เอกสารนี้เป็น snapshot ของงานวันที่ 15/10/2026 ไม่แก้/เขียนทับรายงาน audit เดิม. `Audit/` ถูก ignore โดย Git: ไฟล์นี้อยู่ในเครื่อง แต่ **ไม่ติด Git โดยอัตโนมัติ**.

## เอกสารเชื่อมโยง

- [[2026-10-14 Pending Order Reentry Plan]] — scope, acceptance cases และ safety gate ฉบับรวม.
- [[01-undelivered-warning]] — source trace ของบั๊ก A.
- [[01-preflight-and-safety-report]] — preflight และ datastore safety.
- [[02-architecture-and-api-contract]] — durable session contract และ policy ที่อนุมัติ.
