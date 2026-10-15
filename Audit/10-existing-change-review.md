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
2. **TTL cleanup — แก้บางส่วนแล้วด้วย lazy expiry (E2, mock verified).** ปัจจุบัน `release()` และ `withLockedActive()` (ใช้โดย PATCH/POST) reap session ที่หมดอายุภายใต้ slot lock: cancel เฉพาะ pending, end session, clear slot. **ยังเหลือ:** ห้องที่ไม่มี request ใดแตะอีกจะไม่ถูกปิดใน DB จนกว่าจะมีการ acquire/release/PATCH — ผู้ใช้ยอมรับแล้วเพราะ GET/list กรอง expired ออกอยู่ (`:64-74`). ไม่มี background job; ไม่ได้ทดสอบ MySQL จริง. เดิมระบุไว้ว่า "ไม่มี transition ที่รัน ณ expiry" — ข้อความนั้นถูกแก้ที่ต้นทางแล้ว.
3. **Medium — mock transaction ยังไม่จำลอง rollback/concurrency.** แก้ test harness B02a แล้ว: `test/fitting-session-lifecycle.test.js:31-47` แยก set-active/clear-active ตาม params และ WHERE, `:77` assert ว่า release ล้าง slot ห้อง `1` จริง. Lead อ่าน source และรัน focused mock test อีกครั้ง: exit 0, 3/3 ผ่าน. `database/db.js:83-90` ยัง mock transaction แบบ callback ไม่มี rollback/row lock; ผลนี้ไม่พิสูจน์ atomicity, concurrent conflict หรือพฤติกรรม MySQL. ไม่ได้สังเกต RED ก่อนแก้ mock จึงไม่อ้าง RED→GREEN.
4. **Medium — PATCH `complete` idempotency ผ่าน mock เท่านั้น.** Route คืนค่า `FTR_FinishTime` เดิมสำหรับ complete→complete โดยไม่ UPDATE; mock ยืนยัน 200/no UPDATE. MySQL `affectedRows` guard ของ transition แรก (`database/db.js:103-106`) ยังไม่ได้ทดสอบใน isolated DB และไม่อ้างว่า verified บน production.
5. **GET customer ไม่ส่ง `roomId` — แก้แล้ว (E1, mock verified).** ตอนนี้ตอบ 400 ก่อนรัน SQL; ไม่มี caller ใน repo ที่พึ่งพฤติกรรมเดิม. เดิมรวม row ของทุก active room ของเจ้าของเดียวกัน (ไม่ใช่ cross-owner leak เพราะมี `s.CUS_ID = user.id`).
6. **Deployment gate — DDL ใน working tree ยังไม่เท่ากับ DB จริง.** `database/migrations/20261015_durable_fitting_sessions.sql:4-26` และ `database/schema.sql:102-145` เพิ่ม table/column ที่ routes ใหม่อ้าง (`routes/api.js:381-393`), แต่ยังไม่มีหลักฐาน migration applied; หากรันโค้ดใหม่กับ schema เดิม API จะ query ตาราง/column ที่ยังไม่มี. ต้องแยก rollout/isolated verification ก่อน deploy. Legacy rows ยัง NULL ตาม design; ห้าม backfill อัตโนมัติ.

## สิ่งที่ตรวจได้และยังตรวจไม่ได้

- Bug A client GET fail-closed และ warning path มี mock regression ที่ผ่าน; ไม่มี browser E2E. `views/customer/fitting-room.ejs:261-309,311-335,448-452` ตรวจ status/payload ก่อน release และไม่ navigate เมื่อ release ล้มเหลว.
- `routes/views.js` acquire ก่อน render, `utils/fittingSessions.js:7-48,77-89` ใช้ slot lock ภายใน transaction; ไม่อ้างว่า MySQL locking/DDL verified. DB schema snapshot ใน [[01-preflight-and-safety-report]] เป็นอดีต ไม่ใช่ live probe รอบนี้.
- Agent check: `delegate_task list` รอบนี้ 0 live; OS check แบบ scoped ไม่พบ Antigravity/cloudcode process ที่ cwd เป็น repo ณ เวลาตรวจ. นี่ไม่รับประกันว่า IDE จะไม่กลับมาเปิด/เขียนภายหลัง; ตรวจ status/process ใหม่ก่อนมอบงาน write.

## B02a — เสร็จเฉพาะ test-harness integrity

Subagent แก้เพียง `test/fitting-session-lifecycle.test.js` (untracked เดิม) แยก SQL update ตาม param order/WHERE และ assert slot `1` เป็น `null` หลัง release. Lead อ่านไฟล์ที่แก้และ `database/db.js`, ตรวจ `git status`/`git diff --check`, รัน `USE_MOCK_DB=true node --test --test-reporter=spec test/fitting-session-lifecycle.test.js`: exit 0, tests 3/pass 3/fail 0. Subagent รายงาน 3/3 เช่นกัน แต่ยึดผล Lead เป็นหลักฐาน. ไม่อ้าง RED ที่ไม่ได้รันจริง; ไม่ใช่ MySQL/concurrency verification.

## Approval/stop gate

ผู้ใช้ยืนยัน strict transition policy แล้ว (pending→preparing→complete; complete→complete idempotent; ห้าม reset pending/skip preparing). แก้ `routes/api.js` Staff PATCH ให้ validate transition และ guarded conditional UPDATE พร้อมเพิ่ม `test/fitting-order-transition.test.js` 7 กรณี: RED 1/1 (direct complete ได้ 200 แทน 409) → GREEN 1/1; ชุด targeted รวม Bug A/B 23/23 ผ่าน (exit 0), `node --check routes/api.js` และ `git diff --check` exit 0. ผลเหล่านี้เป็น mock-only ไม่พิสูจน์ SQL จริง, locking หรือ Production. DB-write tests และ migration ยัง blocked จนมี isolated DB + approval แยก; ยังต้อง review E2E/other callers, schema compatibility และ safety ก่อน rollout.

## Caller inventory (read-only, 2026-10-15)

`search_files` หา `fitting-orders` ทั้ง repo (`*.js|*.ejs|*.html`) พบ caller จริงเพียง 4 จุด:

| Caller | Endpoint | ผลต่อการเปลี่ยนรอบนี้ |
| --- | --- | --- |
| `views/staff/fitting.ejs:221` | `PATCH /:id` ส่งเฉพาะ `preparing` (จาก pending) และ `complete` (จาก preparing) ตามปุ่ม `:159,:165` | **เข้ากันได้** กับ strict state machine; ไม่มี UI ส่ง `pending` หรือข้ามขั้น. ข้อสังเกต: เมื่อได้ 409 UI แสดงแค่ alert generic "Server returned error status" (`:228,:241`) และ rollback optimistic ได้ถูกต้อง — ปรับข้อความเป็นงานเสริม ไม่บล็อก |
| `views/staff/fitting.ejs:93` | `GET ?limit=5&myOnly=true` | staff path ไม่ผูก roomId โดยตั้งใจ |
| `views/customer/fitting-room.ejs:265` | `GET ?roomId=<barcode>` | ส่ง roomId เสมอ |
| `public/js/app.js:462` | `POST` พร้อม `roomId` + `sessionId` | ส่ง session ที่ client ถืออยู่; server ต้องตรวจเทียบ active session (ครอบด้วย lifecycle test) |

**ข้อสรุปสำหรับ finding #5:** ไม่มี customer caller ใดเรียก `GET /api/fitting-orders` โดยไม่ส่ง `roomId` → การบังคับ `roomId` สำหรับ role CUSTOMER **ไม่กระทบ caller เดิม**. ยังไม่แก้โค้ด รอการอนุมัติ (ดูแผนด้านล่าง). ข้อจำกัด: ตรวจเฉพาะ source ใน repo ไม่รวม client ภายนอก/mobile ที่อาจมี.

## แผนที่เสนอ (รออนุมัติ — ยังไม่ลงมือ)

| ID | งาน | ขอบเขต | หลักฐานที่จะได้ |
| --- | --- | --- | --- |
| E1 | Customer `GET` ไม่ส่ง `roomId` → HTTP 400 (fail closed) | `routes/api.js` + 1 test ใน `test/fitting-order-room-alias.test.js` | mock RED→GREEN |
| E2 | Expiry reconciliation: เมื่อ session หมดอายุ ให้ปิด session + cancel pending **แบบ lazy ที่จุดอ่าน/เขียนที่มีอยู่** (GET active, enter, POST, PATCH เรียก `expireStale(room)` ภายใต้ slot lock เดิม) แทน background job | `utils/fittingSessions.js` + test ใน `test/fitting-session-lifecycle.test.js` | mock RED→GREEN; ไม่มี cron/timer จึงไม่มี concurrency ใหม่นอก lock เดิม |
| E3 | ข้อความ error ของ staff UI เมื่อ 409 (ใช้ `message` จาก API) | `views/staff/fitting.ejs` | ตรวจด้วยตา/unit เล็ก ไม่บล็อก |

เหตุผลเลือก lazy แทน job: ทุกทางที่ปล่อยให้ pending ของ session หมดอายุโผล่ ต้องผ่าน endpoint ที่ถือ slot lock อยู่แล้ว; job แยกต้องออกแบบ lock/leader/restart เพิ่ม และทดสอบบน MySQL จริงซึ่งยังทำไม่ได้ (ไม่มี isolated DB). ข้อด้อย: pending ของห้องที่ไม่มีใครแตะอีกจะยังเป็น `FTR_CancelledAt IS NULL` ใน DB แต่ **ไม่แสดงใน GET** เพราะ JOIN active slot กรองอยู่ — ต้องยืนยันว่ายอมรับสถานะ DB แบบนี้ได้หรือไม่.

## E1–E3 — ลงมือแล้ว (2026-10-15, อนุมัติโดยผู้ใช้; mock-only)

ผู้ใช้อนุมัติ E1+E2+E3 และยอมรับว่า pending ของห้องที่ไม่มีใครเข้าอีกค้างเป็น `FTR_CancelledAt IS NULL` ใน DB ได้ (GET กรองด้วย JOIN active slot อยู่แล้ว).

| ID | การเปลี่ยนแปลง | หลักฐาน |
| --- | --- | --- |
| E1 | `routes/api.js` GET: role CUSTOMER ไม่ส่ง `roomId` → 400 ก่อนรัน SQL ใด ๆ | RED: ได้ 500 (เดิมไปรัน query) → GREEN: 400 และ SQL calls = 0 |
| E2 | `utils/fittingSessions.js` เพิ่ม `reapExpired()` เรียกใน `release()` และ `withLockedActive()` ภายใต้ slot lock เดิม: ถ้า session หมดอายุ → cancel เฉพาะ pending, end session (`EXPIRED`), clear slot แล้วตอบ `NOT_ACTIVE`; preparing/complete คงเป็นประวัติ | RED: pending ไม่ถูก cancel 2/2 → GREEN; control test session ที่ยังไม่หมดอายุไม่ถูก reap ผ่านทั้ง RED และ GREEN |
| E3 | `views/staff/fitting.ejs` แปลง error code (`NOT_ACTIVE`, `STALE_ORDER`, `NOT_OWNER`, `INVALID_TRANSITION`, `COMPLETE_IMMUTABLE`) เป็นข้อความไทย | ไม่มี unit test; ตรวจเพียง `ejs.compile` ผ่านและ inline `<script>` parse ผ่าน — **ยังไม่ได้ดูใน browser** |

**ผลรัน:** `USE_MOCK_DB=true node --test --test-reporter=spec` 4 ไฟล์ (`fitting-order-transition`, `fitting-session-lifecycle`, `fitting-order-room-alias`, `customer-exit-warning`) → exit 0, tests 27/pass 27/fail 0. `node --check routes/api.js`, `node --check utils/fittingSessions.js`, `git diff --check` exit 0. Output บันทึกที่ Hermes scratch `e-red.txt` / `e-green.txt`; ข้อความ `network down` ใน output เป็น fixture ของ fail-closed test.

**ขอบเขตที่ยังไม่ครอบ:** (1) `USE_MOCK_DB=true npm test` รันแล้วในรอบนี้ — ผล 68/53/15 (ดูหัวข้อถัดไป); failure ทั้งหมดมาจาก suite เก่าที่ยัง mock ดีไซน์เดิม ไม่ใช่จาก E1–E3. (2) `acquire()` เดิมมี logic ปิด session หมดอายุ inline อยู่แล้ว (`utils/fittingSessions.js:39-41`) ไม่ได้แก้และไม่ได้ใช้ `reapExpired`. (3) expiry จริงที่ MySQL (`FTR_LastSeenAt` เทียบ `NOW()`, `FOR UPDATE`) ยังไม่ได้ทดสอบ — รอ isolated DB. (4) การ reap ใน `release` ทำให้ release ของ session ที่หมดอายุตอบ `NOT_ACTIVE` พร้อม side effect commit; client ที่ถือ session เก่าจึงเห็นผลเหมือนเดิมแต่ DB ถูกปิดแล้ว.

## Full `npm test` (mock) — ปิดจบ 2026-10-15: 71 tests / pass 71 / fail 0

รอบแรกของวันรันแล้วได้ **68 tests / pass 53 / fail 15** โดยพบว่าทั้ง 15 failure มาจากรากเดียว: สอง suite เก่า (`tests/audit-regression.test.js`, `test/room-exit.test.js`) ยัง mock **ดีไซน์เดิม** (memory occupancy + คอลัมน์ `FTR_ReleasedAt`/`FTR_CustomerPresent`) และไม่มี handler สำหรับ `FITTING_ROOM_SLOT`/`FITTING_ROOM_SESSION` → mock คืนค่าว่าง → `acquire()` โยน `Session slot unavailable` → route ตอบ 503 (ไม่ใช่ผลจากตรรกะธุรกิจใหม่). E1–E3 ของรอบนั้น **ไม่ได้เพิ่ม failure** เลย.

**แก้แล้วทั้งสอง suite** (ผู้ใช้อนุมัติให้อัปเดตให้ตรง durable session):

- `tests/audit-regression.test.js` → **25/25 ผ่าน**: เพิ่ม mock store `mockSlots`/`mockSessions` + handler สำหรับ slot/session (INSERT IGNORE slot, `FOR UPDATE` lock, session lookup/insert, `FTR_LastSeenAt`/`FTR_EndedAt`, set/clear slot, `FTR_CancelledAt`, getActive/listActive, guarded conditional UPDATE ของ PATCH). Handler ของ session block ถูกวาง **ก่อน** matcher ของ `FITTING_ROOM` เพราะ `INSERT INTO FITTING_ROOM_SESSION` มี substring `INSERT INTO FITTING_ROOM`. เทสต์ที่ premise ล้าสมัยถูกเขียนใหม่: "entering writes no occ_ row (occupancy in memory)" → assert ว่า pin slot + เขียน session row และไม่เขียน order row; "releasing a room you do not hold" เลิก assert บน `roomOccupancy` แล้วหันไป assert slot/session; PATCH complete เปลี่ยนเป็น 2 ขั้น (preparing → complete) และเพิ่มเทสต์ `INVALID_TRANSITION` 409 สำหรับ pending→complete และ rollback →pending
- `test/room-exit.test.js` → **13/13 ผ่าน**: เขียน mock `mockSessionStore()` แทน memory occupancy; เทสต์ "release endpoint tolerates an empty POST body from an older client" **กลับข้อคาดหวังโดยเจตนา** — policy ที่อนุมัติให้ customer release ต้องระบุ session จึง assert 403 + session ไม่ถูกแตะ แทน 200 แบบเดิม; เพิ่มเทสต์ release สำเร็จล้าง slot และ release ห้องว่างได้ 403; ลบ import `roomOccupancy` ที่ไม่ใช้แล้วทั้งสองไฟล์

**ผลรวม mock suite วันนี้:** `USE_MOCK_DB=true npm test` → exit 0, **71 tests / 71 pass / 0 fail**; `USE_MOCK_DB=true node --test test/*.test.js` → exit 0, **40 tests / 40 pass / 0 fail** (ทั้งสองชุดไม่ทับกัน). `node --check routes/api.js`, `node --check utils/fittingSessions.js`, `git diff --check` exit 0. Output ที่ Hermes scratch: `npm-test.txt` (ก่อนแก้), `npm-test-2.txt`, `npm-test-final.txt`, `test-dir2.txt`, `room-exit.txt`, `audit-reg.txt`.

**ข้อจำกัดของข้อกล่าวอ้าง:** baseline "68/68 ผ่าน" ก่อนหน้า durable-session refactor เป็นรายงานจากรอบก่อน — ผมไม่ได้ยืนยันเอง. ทั้งหมดเป็น **mock-only**: ไม่พิสูจน์ MySQL locking/`affectedRows`/DDL, ไม่มี browser E2E, ไม่มี isolated DB. `tests/` ถูก gitignore → `tests/audit-regression.test.js` เป็นไฟล์ในเครื่อง ไม่ได้ถูก track (ส่วน `test/*.test.js` tracked/untracked ตามรายการ Git).

## เอกสารเชื่อมโยง

- [[09-recovery-checkpoint]] — Git/process snapshot และ outstanding constraints.
- [[02-architecture-and-api-contract]] — approved state machine และ lifecycle policy.
- [[2026-10-14 Pending Order Reentry Plan]] — acceptance เริ่มต้น.
- [[2026-10-15 Pending Order Reentry Work Plan]] — work plan.
