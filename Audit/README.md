# Audit — Index & สถานะเอกสาร (crwn.st)

> **อัปเดต:** 2026-10-15 · จัดทำโดย Lead review · เอกสารอื่นในโฟลเดอร์นี้เป็น snapshot ตามเวลาที่เขียน **ห้ามใช้แทนสถานะล่าสุด**
> **สถานะ Git:** `.gitignore` ไม่ ignore `Audit/` แล้ว แต่ยังไม่มีไฟล์ใดถูก commit (`git ls-files -- Audit` ว่าง) — ทุกไฟล์เป็น `??` untracked

---

## 1. ใช้อยู่ (Active) — รอบบั๊ก A/B (Pending Order Reentry)

| ไฟล์ | บทบาท | อ่านเมื่อ |
| --- | --- | --- |
| [[10-existing-change-review]] | **Source of truth ของสถานะปัจจุบัน** — findings, หลักฐาน mock test, approval/stop gate | ทุกครั้งก่อนทำงานต่อ |
| [[02-architecture-and-api-contract]] | Contract + business policy ที่ **อนุมัติแล้ว** (state machine, release semantics, DB additive change) | ก่อนแก้ route/schema |
| [[2026-10-14 Pending Order Reentry Plan]] | Scope, acceptance cases A01–A04 / B01–B06, safety gate ฉบับรวม | ก่อนออกแบบ test/migration |
| [[01-preflight-and-safety-report]] | Preflight + ตาราง safety ของแต่ละคำสั่ง test (อะไรห้ามรัน) | ก่อนรัน test/แตะ DB |
| [[01-undelivered-warning]] | Source trace ของบั๊ก A (หลักฐานระดับ code) — **Task IDs T01–T03 ล้าสมัย** | อ้างอิงรากของบั๊ก A |

## 2. ล้าสมัยแล้ว — ย้ายเข้า `Archive/` แล้ว (2026-10-15)

| ไฟล์ | เหตุที่ล้าสมัย | แทนด้วย |
| --- | --- | --- |
| [[2026-10-15 Pending Order Reentry Work Plan]] | เขียนว่า "ยังไม่รายงานจำนวนที่ผ่าน / ยังไม่ยืนยัน GREEN" — ปัจจุบันมีผล 23/23 แล้ว | [[10-existing-change-review]] |
| [[09-recovery-checkpoint]] | snapshot ตอน Recovery (R2 next-task, `Audit/` ยังถูก ignore) — สองข้อนี้ไม่จริงแล้ว | [[10-existing-change-review]] |

ย้ายโดยไม่ลบและไม่แก้เนื้อหา (Obsidian wikilink ผูกด้วยชื่อไฟล์ ไม่พังเมื่อย้ายโฟลเดอร์) — เนื้อหาข้างในยังอ้างสถานะเดิมเสมอ ให้ยึด [[10-existing-change-review]] เป็นหลัก

## 3. Archive — รอบก่อน (2026-10-14, bug BUG-001…007) ปิดงานแล้ว

`01-system-map` · `02-bug-investigation` · `03-root-cause-and-fix-plan` · `04-task-breakdown` · `05-regression-test-plan` · `06-execution-order` · `07-handoff-to-coding-model` · `08-live-db-verification` · `09-independent-verification` · `10-browser-e2e-run` · [[2026-10-14 Room Exit Regression]] · [[2026-10-14 Room Plan 10 Rooms and Occupancy]]

**แผนในชุดนี้ใช้ไม่ได้แล้ว** แต่ **ห้ามลบ** เพราะ `08`/`09`/`10` เป็นหลักฐานที่ตรวจจริง (live DB + browser E2E 2026-10-14) ของบั๊กชุดเก่า — เป็น tier หลักฐานที่รอบ A/B ยังไม่มี

⚠️ **`Archive/10-browser-e2e-run` ยังเป็นเอกสารเปิด** — บันทึกบั๊กที่ยังไม่แก้: `POST /api/auth/logout` ลบตะกร้าลูกค้า (`routes/auth.js:177-180`) และออเดอร์ทดสอบ `fo_f45b079c-…` ยังค้างใน DB รอคำสั่ง

## 4. Raw artifacts (ไม่ใช่เอกสาร) — ปิดความเสี่ยงแล้ว (2026-10-15)

อยู่ใน `Audit/Archive/`: `apply_migration_20261014.js`, `test_migration_on_copy.js`, `backup_and_archive.js`, `inspect_fitting_room.js`, `backup_fitting_room_20261014.sql`, `backup_fitting_room_20261014.json`, `archive_occ_rows.csv`

**ความเสี่ยงที่พบและแก้แล้ว:** backup ทั้งสามมี **row data จากฐานจริง** (`FTR_OrderID`, `FTR_SessionID`, `CUS_ID` เช่น `u1`) และ `Audit/` ไม่ถูก ignore แล้ว จึงพร้อมถูก commit/push ไป `origin/main`. เพิ่ม `.gitignore` แบบ scoped แล้ว:

```gitignore
Audit/Archive/*.sql
Audit/Archive/*.json
Audit/Archive/*.csv
Audit/Archive/*.js
```

**ยืนยันผล:** `git ls-files --others -i --exclude-standard -- Audit/` แสดง artifact ทั้ง 7 ไฟล์เป็น ignored และ `git check-ignore database/schema.sql` ไม่ match — schema/migration จริงไม่ได้รับผลกระทบ

ไฟล์ยังอยู่ครบในเครื่อง (ไม่ลบ); ถ้าต้องการเก็บถาวรจริงให้ย้ายออกนอก repo หรือคัดลอกไปที่อื่น

## 5. ความเชื่อมโยงที่ห้ามสับสน

- ชุดเลข `01`–`10` ใน `Archive/` เป็น**คนละรอบ**กับ `01-preflight-and-safety-report` / `09-recovery-checkpoint` / `10-existing-change-review` — ชื่อไฟล์ไม่ชนกันจึงไม่พัง link แต่ให้ยึดตามรอบ
- หลักฐาน browser/live DB 2026-10-14 (Archive) **ไม่ใช่หลักฐานของบั๊ก A/B** — รอบ A/B ยังไม่มี isolated DB, migration applied, หรือ browser E2E
- `08-live-db-verification` เก็บ schema ก่อน normalization; preflight ยืนยันว่าฐานปัจจุบัน **ไม่มี** `FTR_SessionID`/`FTR_CancelledAt` (ณ เวลาตรวจนั้น)
- `Archive/backup_fitting_room_20261014.*` มีคอลัมน์ `FTR_CustomerPresent`, `FTR_SessionID`, `FTR_ReleasedAt` — หลักฐานว่า**รอบก่อนเคยมี session columns แล้วถูก `20261014_room_schema_and_numbers.sql` ลบออก**; migration ใหม่ `20261015_durable_fitting_sessions.sql` จึงเป็นการ**เพิ่มกลับแบบ additive** ไม่ใช่ของใหม่ **ห้าม apply migration เก่าซ้ำ** (มี DELETE/UPDATE/DROP)

## เอกสารเชื่อมโยง

- [[10-existing-change-review]] — สถานะล่าสุด
- [[2026-10-14 Pending Order Reentry Plan]] — scope/acceptance
- [[02-architecture-and-api-contract]] — policy ที่อนุมัติ
