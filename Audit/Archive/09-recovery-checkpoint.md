# crwn.st — Recovery Checkpoint (15/10/2026)

> **Phase:** R0/R1 เท่านั้น — อ่านสถานะและบันทึก checkpoint; ไม่แก้ implementation, ไม่รัน tests/migration/seed/server และไม่เขียน DB  
> **ฐานหลักฐาน:** คำสั่ง Git และ source ใน working tree รอบ recovery นี้; รายงานเก่าเป็น historical snapshot ไม่ใช่ผลทดสอบปัจจุบัน

## 1. Git และ working tree

- `git status --short --branch --untracked-files=all` → `## main...origin/main`; `git rev-parse HEAD` → `01e426d04a062a40cd91be1797e61dcb16d43772`.
- **Unstaged tracked changes:** `database/schema.sql` (M), `routes/api.js` (M), `routes/views.js` (M), `test/customer-exit-warning.test.js` (A ใน working tree), `views/customer/fitting-room.ejs` (M). `git diff --stat`: 5 files, 243 insertions, 126 deletions. `git diff` ตรวจอ่านแล้ว; LF→CRLF warning จาก Git ไม่ใช่ผลทดสอบ.
- **Staged:** ไม่มี (`git diff --cached --stat`, `git diff --cached` ว่าง). ระวัง: ` A` ใน `git status --short` หมายถึง **unstaged added** ไม่ใช่ staged.
- **Untracked:** `database/migrations/20261015_durable_fitting_sessions.sql`, `test/fitting-order-room-alias.test.js`, `test/fitting-session-lifecycle.test.js`, `utils/fittingSessions.js` (`git ls-files --others --exclude-standard`).
- **Ignored ที่เกี่ยวข้อง:** `Audit/01-preflight-and-safety-report.md`, `Audit/01-undelivered-warning.md`, `Audit/02-architecture-and-api-contract.md`, `Audit/2026-10-14 Pending Order Reentry Plan.md`, `Audit/2026-10-15 Pending Order Reentry Work Plan.md` และ `Audit/Archive/` (มี backup/scripts เดิม); `tests/audit-regression.test.js`, `tests/fitting-room-view.test.js`, `tests/room-ui.test.js`, `tests/roomOccupancy.test.js`, `tests/roomResolver.test.js`. ตรวจด้วย `git ls-files --others -i --exclude-standard -- Audit/ tests/`; checkpoint นี้จะถูก ignore ด้วย. **อย่า force-add ทั้ง `Audit/` เพราะมี backup/archive.**
- ตรวจ `AGENTS.md`, `.hermes.md`, `CLAUDE.md` ตั้งแต่ vault root ถึง `Audit/`: ไม่พบ. ไม่ได้ reset/clean/checkout/stash.
- Attribution: หลักฐานการสนทนาก่อนหน้าระบุ Lead ลงแก้ `routes/api.js`, `routes/views.js`, helper, schema/migration และ tests; subagent เคยส่งงาน Bug A ที่ view/test. Git diff เพียงอย่างเดียวไม่พิสูจน์ผู้แก้แต่ละ hunk; ไฟล์ทั้งหมดที่ระบุข้างต้น **ยังไม่ได้รับ final review/acceptance**.

## 2. Existing implementation และงานค้าง

- Bug A: view เปลี่ยนให้ GET error หรือ payload ไม่ใช่ array หยุด exit (fail closed); `test/customer-exit-warning.test.js` เพิ่ม mock harness. ยังไม่มีหลักฐาน browser/production acceptance.
- Bug B: `utils/fittingSessions.js` ใช้ transaction + room slot row lock; `routes/api.js` เปลี่ยน GET เป็น active-session JOIN, enter/release/INSERT เป็น durable session และ PATCH guard order; `routes/views.js` acquire ก่อน render. `database/schema.sql` กับ migration ใหม่เพิ่ม registry/slot/session/cancel columns; tests lifecycle/alias ยัง untracked. Source diff ตรวจพบว่า PATCH ยังรับ `pending` branch ที่ตั้ง `EMP_ID = NULL` ขณะที่ contract เสนอไม่ rollback ไป pending; ต้อง review business transition/callers ก่อนแก้. GET customer ที่ไม่มี `roomId` ยังต้อง review access boundary; อย่าอ้างว่า auth/session contract ครบ.
- SQL helper และ migration อ่านแล้ว; `database/db.js:83-117` ใช้ mock callback หรือ real transaction ตาม mode. ไม่ยืนยัน actual isolation/locking/DDL compatibility จนทดสอบบน isolated DB. ไม่มีการเปลี่ยน source เพิ่มใน recovery นี้.
- แผนเดิม `2026-10-14 Pending Order Reentry Plan.md` เก็บข้อความ pre-approval ตามเวลาเขียน; policy approval ภายหลังอยู่ใน `02-architecture-and-api-contract.md`. อย่าใช้สถานะจากแผนเดิมแทนสถานะล่าสุด.

## 3. Test evidence

| Command / evidence | Exit | สิ่งที่สรุปได้ |
| --- | --- | --- |
| `node --check routes/api.js && node --check routes/views.js && node --check utils/fittingSessions.js && git diff --check` (รายงานจากรอบก่อน recovery) | 0 ตามบันทึกรอบก่อน | syntax/whitespace เท่านั้น; ไม่ใช่ behavioral regression |
| `npm test` ก่อนเริ่มงานบั๊ก (รายงานรอบก่อน: 68/68) | ไม่เก็บ raw output ใน checkpoint นี้ | baseline เก่า ไม่ใช่ผลหลัง patch |
| `USE_MOCK_DB=true npm test` และ `USE_MOCK_DB=true node --test test/fitting-session-lifecycle.test.js test/fitting-order-room-alias.test.js test/customer-exit-warning.test.js` หลังแก้ก่อนหน้า | output/exit code ที่ตรวจอ่านไม่ได้ | **ไม่ทราบผล**; ห้ามอ้างผ่าน |
| Recovery รอบนี้ | ไม่รัน test | ตามข้อจำกัด R0; ต้องอ่านทุก test/config ก่อนการรันครั้งถัดไป |

**งด** `npm run test:integration`, `node --test tests/api.test.js`, seed, migration, `node server.js` และ browser flow ที่เขียนข้อมูล: preflight ระบุ integration ต่อ DB จริง/guard ไม่เพียงพอ; ยังไม่มี isolated test DB และ approval สำหรับขอบเขตการเขียน. ไม่มีคำสั่งดังกล่าวถูกรันใน recovery นี้.

## 4. Migration และ DB

- พบ migration draft `database/migrations/20261015_durable_fitting_sessions.sql` แบบ **untracked**, เพิ่ม `FITTING_ROOM_SESSION`, `FITTING_ROOM_SLOT`, `FTR_SessionID`, `FTR_CancelledAt` และ index; schema file ใน working tree มี DDL สอดคล้องระดับหัวข้อ. **ไม่มีหลักฐานว่า apply migration แล้ว**; การมี SQL file ไม่ใช่หลักฐาน live schema.
- Read-only Phase 0 probe ก่อนหน้า: DB ณ เวลาตรวจมี `FITTING_ROOM` 6 rows, pending ตาม predicate เดิม 2 rows, ไม่มี session/cancel columns; MySQL 8.0.46 / REPEATABLE-READ ตาม capability probe. **ไม่ได้ probe DB ใหม่รอบ recovery**; สถานะ DB ปัจจุบันและผลต่อ legacy rows ยังไม่ทราบ. แผนห้าม backfill legacy โดยเดา.
- จากประวัติที่มี ไม่พบหลักฐานว่ารอบแก้บั๊กนี้เขียน shared DB; ไม่สามารถพิสูจน์ absence ของ external writes/agent อื่นหรือ migration ที่รันนอก session ได้. หากพบหลักฐานใหม่ว่าเคยเขียน shared DB ให้ยกระดับเป็น incident; ไม่ย้อนข้อมูลโดยเดา.

## 5. Agent loop และ concurrent-write gate

- `delegate_task(action='list')` รายงาน **0 live subagents**; `process_manage(action='list')` รายงาน **ไม่มี managed background terminal processes**. Subagent ที่เคยค้างมีรายงาน `paused_by_request` และไม่มี diff จากงานนั้นตาม handoff; ไม่มี loop ที่เห็นใน Hermes scope นี้ จึงไม่ kill process ใด.
- OS process inventory แบบไม่พิมพ์ credentials พบ TypeScript language-server/tsserver หลายตัวใน repo และ **Antigravity IDE / cloudcode_cli.exe** อีกชุดเปิด repo อยู่. ไม่ทราบว่า IDE/agent ภายนอกกำลังเขียนไฟล์หรือไม่; `git status` สองรอบระหว่าง recovery แสดงรายการเดียวกัน แต่ไม่พิสูจน์ว่าไม่มี concurrent writer. **ห้าม spawn coding subagent จนยืนยัน ownership/idle ของ IDE ที่เปิด repo และขอบเขตไฟล์.**
- Hermes รองรับ `delegate_task list/steer/stop` สำหรับ live children และ `process_manage` สำหรับ managed background processes; ไม่ใช้การ kill OS process แบบเหมารวม. ยังไม่ได้ตั้ง tool-call/iteration limit จริง และยังไม่ได้ตรวจ model ID/OpenRouter เพราะ R0 ห้ามเริ่ม coding.

## 6. Task ถัดไปเพียงหนึ่ง Task

**R2 — Lead read-only review ของ existing changes** (`routes/api.js`, `routes/views.js`, `utils/fittingSessions.js`, migration/schema และ contract ที่เกี่ยวข้อง): ทำ inventory ความคลาดเคลื่อนของ session authorization, state transition, transaction/race และ DDL โดยไม่แก้โค้ดหรือรัน test. **Owner: Lead (GPT-6 Sol)**; ไม่มอบหมาย coding subagent จนกว่า concurrent-write gate ผ่าน. ผลที่ต้องส่งคือ defect list ที่ผูกกับ source line และ Task Brief หนึ่งเรื่องให้ coding subagent ภายหลัง หากผู้ใช้อนุมัติเดินหน้าหลังรายงานนี้.

## 7. Approval / stop conditions

- รอการตัดสินใจว่าจะเดินหน้า R2 และขอให้ยืนยันว่า Antigravity/agent ภายนอกที่เปิด repo จะไม่แก้ไฟล์ชุดเดียวกันระหว่างทำงาน; หากยืนยันไม่ได้ ให้จำกัดงานเป็น read-only.
- ก่อน coding ต้องมี brief ระบุ allowed files, tests, budget/stop conditions และตรวจ model configuration จริง; ห้ามเริ่มใหม่ซ้อน agent เก่า. ก่อนรัน mock test ต้องอ่านทุก test/config ที่ command ใช้; ก่อน isolated integration ต้องพิสูจน์ DB แยกและอนุมัติขอบเขต write. ห้าม migration/shared DB write โดยอัตโนมัติ.

## เอกสารเชื่อมโยง

- [[2026-10-15 Pending Order Reentry Work Plan]] — snapshot งานก่อน recovery.
- [[01-preflight-and-safety-report]] — DB/test safety.
- [[02-architecture-and-api-contract]] — policy และ contract ที่อนุมัติ.
- [[2026-10-14 Pending Order Reentry Plan]] — scope/acceptance เริ่มต้น.
