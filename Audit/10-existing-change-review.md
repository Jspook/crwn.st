# crwn.st — R2 Review ของ Changes ที่ค้าง (15/10/2026)

> **Scope:** R2 read-only review ตามด้วย B02a test-harness fix และ Staff PATCH transition fix หลังผู้ใช้อนุมัติ policy; ไม่มี schema/data write, migration หรือ integration test ในรอบนี้  
> **Baseline:** `main` HEAD `01e426d04a062a40cd91be1797e61dcb16d43772`; Git status ก่อนเริ่ม R2 ตรงกับ [[09-recovery-checkpoint]]

## หลักฐานการทดสอบรอบนี้

- อ่านทุก test ที่จะรัน: `test/customer-exit-warning.test.js`, `test/fitting-order-room-alias.test.js`, `test/fitting-session-lifecycle.test.js`; ตรวจ `database/db.js` mock/transaction path และ route import ก่อนรัน. ทั้งสามใช้ in-memory mock/VM หรือ loopback HTTP, ตั้ง `USE_MOCK_DB=true`; `getPool()` ปฏิเสธ live pool ใน mode นี้ (`database/db.js:12-16`). ไม่ใช้ shared DB.
- `USE_MOCK_DB=true node --test --test-reporter=spec test/fitting-session-lifecycle.test.js test/fitting-order-room-alias.test.js test/customer-exit-warning.test.js` → exit 0, `tests 16`, `pass 16`, `fail 0`. **หลักฐานเฉพาะ mock targets**; ไม่ใช่ DB integration, browser หรือ production verification. การเรียกก่อนหน้าที่ไม่ได้ระบุ reporter ได้ exit 0 แต่ stdout ว่าง จึงไม่นำมาใช้ยืนยัน count.
- หลัง policy approval อ่าน `test/fitting-order-transition.test.js` และรัน targeted 4 ไฟล์ (`customer-exit-warning`, `fitting-order-room-alias`, `fitting-session-lifecycle`, `fitting-order-transition`) ด้วย `USE_MOCK_DB=true node --test --test-reporter=spec`: exit 0, tests/pass 23, fail 0. Transcript บันทึกที่ Hermes scratch `transition-targets.txt`; network error ใน output เป็น deliberate test fixture ของ fail-closed case.
- `npm run test:integration`, migration, seed/server ไม่รัน: ยังไม่มี isolated DB และ approval ของขอบเขต DB writes.

## Findings จาก source (ยังไม่ใช่ live behavior)

1. **PATCH state machine — แก้ตาม policy ที่ผู้ใช้ยืนยันแล้ว (mock verified).** เดิม `routes/api.js` ยอม reset เป็น pending และ complete จาก pending. ปัจจุบัน `routes/api.js:680-700` บังคับ pending→preparing→complete, complete→complete idempotent และ conditional UPDATE/affected-row guard; `test/fitting-order-transition.test.js` 7 cases ผ่าน. Staff UI เรียก preparing/complete (`views/staff/fitting.ejs:159-165`). ยังไม่ยืนยันกับ MySQL/other callers/Production.
2. **High — TTL cleanup ไม่เกิดเองเมื่อหมดเวลา.** `utils/fittingSessions.js:51-59` ปฏิเสธ release หาก expired; `:64-74` ซ่อน expired จาก GET/list; `:39-41` ปิด session/ยกเลิก pending เฉพาะเมื่อ acquire ใหม่. จึงไม่มี transition ที่รัน ณ expiry หากห้องไม่มีคน acquire อีกครั้ง; session registry และ pending เดิมค้างจนกว่าจะมี request acquire. Contract `02-architecture-and-api-contract.md:18` ต้องการ expiry transition/reconciliation; ต้องออกแบบ job/trigger ที่มี locking และ safety review ก่อนเพิ่ม.
3. **Medium — mock transaction ยังไม่จำลอง rollback/concurrency.** แก้ test harness B02a แล้ว: `test/fitting-session-lifecycle.test.js:31-47` แยก set-active/clear-active ตาม params และ WHERE, `:77` assert ว่า release ล้าง slot ห้อง `1` จริง. Lead อ่าน source และรัน focused mock test อีกครั้ง: exit 0, 3/3 ผ่าน. `database/db.js:83-90` ยัง mock transaction แบบ callback ไม่มี rollback/row lock; ผลนี้ไม่พิสูจน์ atomicity, concurrent conflict หรือพฤติกรรม MySQL. ไม่ได้สังเกต RED ก่อนแก้ mock จึงไม่อ้าง RED→GREEN.
4. **Medium — PATCH `complete` idempotency ผ่าน mock เท่านั้น.** Route คืนค่า `FTR_FinishTime` เดิมสำหรับ complete→complete โดยไม่ UPDATE; mock ยืนยัน 200/no UPDATE. MySQL `affectedRows` guard ของ transition แรก (`database/db.js:103-106`) ยังไม่ได้ทดสอบใน isolated DB และไม่อ้างว่า verified บน production.
5. **Medium — `GET /api/fitting-orders` ของ customer เมื่อไม่ส่ง `roomId` ไม่ผูก active session ที่ระบุ.** `routes/api.js:395-411` เรียก `getActive`/เทียบ session เฉพาะมี roomId; query ยัง JOIN active slot จึงไม่แสดง row ของ closed session แต่ลูกค้าที่มีหลาย active rooms อาจได้หลาย session ภายใต้เจ้าของเดียวกัน. ต้องตัดสินว่าต้อง require roomId หรืออนุญาตรวมทุก active rooms; **ไม่อ้าง cross-owner leak** เพราะมี `s.CUS_ID = user.id`.
6. **Deployment gate — DDL ใน working tree ยังไม่เท่ากับ DB จริง.** `database/migrations/20261015_durable_fitting_sessions.sql:4-26` และ `database/schema.sql:102-145` เพิ่ม table/column ที่ routes ใหม่อ้าง (`routes/api.js:381-393`), แต่ยังไม่มีหลักฐาน migration applied; หากรันโค้ดใหม่กับ schema เดิม API จะ query ตาราง/column ที่ยังไม่มี. ต้องแยก rollout/isolated verification ก่อน deploy. Legacy rows ยัง NULL ตาม design; ห้าม backfill อัตโนมัติ.

## สิ่งที่ตรวจได้และยังตรวจไม่ได้

- Bug A client GET fail-closed และ warning path มี mock regression ที่ผ่าน; ไม่มี browser E2E. `views/customer/fitting-room.ejs:261-309,311-335,448-452` ตรวจ status/payload ก่อน release และไม่ navigate เมื่อ release ล้มเหลว.
- `routes/views.js` acquire ก่อน render, `utils/fittingSessions.js:7-48,77-89` ใช้ slot lock ภายใน transaction; ไม่อ้างว่า MySQL locking/DDL verified. DB schema snapshot ใน [[01-preflight-and-safety-report]] เป็นอดีต ไม่ใช่ live probe รอบนี้.
- Agent check: `delegate_task list` รอบนี้ 0 live; OS check แบบ scoped ไม่พบ Antigravity/cloudcode process ที่ cwd เป็น repo ณ เวลาตรวจ. นี่ไม่รับประกันว่า IDE จะไม่กลับมาเปิด/เขียนภายหลัง; ตรวจ status/process ใหม่ก่อนมอบงาน write.

## B02a — เสร็จเฉพาะ test-harness integrity

Subagent แก้เพียง `test/fitting-session-lifecycle.test.js` (untracked เดิม) แยก SQL update ตาม param order/WHERE และ assert slot `1` เป็น `null` หลัง release. Lead อ่านไฟล์ที่แก้และ `database/db.js`, ตรวจ `git status`/`git diff --check`, รัน `USE_MOCK_DB=true node --test --test-reporter=spec test/fitting-session-lifecycle.test.js`: exit 0, tests 3/pass 3/fail 0. Subagent รายงาน 3/3 เช่นกัน แต่ยึดผล Lead เป็นหลักฐาน. ไม่อ้าง RED ที่ไม่ได้รันจริง; ไม่ใช่ MySQL/concurrency verification.

## Approval/stop gate

ผู้ใช้ยืนยัน strict transition policy แล้ว (pending→preparing→complete; complete→complete idempotent; ห้าม reset pending/skip preparing). แก้ `routes/api.js` Staff PATCH ให้ validate transition และ guarded conditional UPDATE พร้อมเพิ่ม `test/fitting-order-transition.test.js` 7 กรณี: RED 1/1 (direct complete ได้ 200 แทน 409) → GREEN 1/1; ชุด targeted รวม Bug A/B 23/23 ผ่าน (exit 0), `node --check routes/api.js` และ `git diff --check` exit 0. ผลเหล่านี้เป็น mock-only ไม่พิสูจน์ SQL จริง, locking หรือ Production. DB-write tests และ migration ยัง blocked จนมี isolated DB + approval แยก; ยังต้อง review E2E/other callers, schema compatibility และ safety ก่อน rollout.

## เอกสารเชื่อมโยง

- [[09-recovery-checkpoint]] — Git/process snapshot และ outstanding constraints.
- [[02-architecture-and-api-contract]] — approved state machine และ lifecycle policy.
- [[2026-10-14 Pending Order Reentry Plan]] — acceptance เริ่มต้น.
- [[2026-10-15 Pending Order Reentry Work Plan]] — work plan.
