# crwn.st — Phase 0: Preflight & Safety Gate

> **Phase Status:** COMPLETE (inspection only) · **Implementation gate:** BLOCKED pending architecture/business-policy approval · 2026-10-14
> **Scope:** [[2026-10-14 Pending Order Reentry Plan]] บั๊ก A/B; ไม่ใช่ผล RED/GREEN หรือ live E2E

## Repository & preservation

- `git status --short --branch && git rev-parse HEAD && git status --porcelain=v1 --untracked-files=all` → `## main...origin/main`, HEAD `01e426d04a062a40cd91be1797e61dcb16d43772`, ไม่มี dirty paths ที่ Git แสดง. คำสั่งนี้ไม่ครอบคลุมไฟล์ที่ ignored.
- ตรวจ `AGENTS.md`, `.hermes.md`, `CLAUDE.md` ตั้งแต่ repo ถึง vault root ไม่พบ. ไม่ได้ reset/checkout/clean/stash หรือแตะ source/schema/data.
- `.gitignore:4` ignore `tests/`, `.gitignore:6` ignore `Audit/`; `tests/roomResolver.test.js`, `roomOccupancy.test.js`, `fitting-room-view.test.js`, `room-ui.test.js`, `audit-regression.test.js` มีในเครื่องแต่ไม่อยู่ใน `git ls-files`. `tests/api.test.js` ถูก track. ไฟล์แผน/รายงานใน `Audit/` ไม่ sync กับ Git โดยอัตโนมัติ. ก่อนแก้ใด ๆ ต้องดูสถานะรวม ignored paths เฉพาะ scope และอย่าเขียนทับของเดิม.
- การตรวจ process/working tree ของ agent อื่นยังไม่พิสูจน์ทั้งหมด; Git clean ไม่ได้หมายความว่าไม่มี agent อื่นทำงานอยู่.

## Evidence — source trace (ไม่ใช่ production behavior)

- `utils/roomOccupancy.js:16-53,55-93`: occupancy/session เก็บใน memory; resume ของเจ้าของเดิม; TTL ลบ entry; restart ทำให้ occupancy ว่าง.
- `routes/api.js:357-467`: GET ตรวจเพียงการมี occupancy ตอน filter และกรอง `FTR_Number` ด้วย barcode/roomId, ไม่เทียบ row-session; `:531-555` release เฉพาะ memory; `:584-645` POST เก็บเลขห้องแต่ไม่ได้บันทึก session; `:666-724` PATCH ไม่ตรวจ active session หรือ affected rows แบบ conditional.
- `views/customer/fitting-room.ejs:261-293`: GET ด้วย barcode; HTTP/fetch error ถูกตีความเป็น `[]` และอาจเข้า no-orders exit; warning ของ pending/preparing อยู่ที่ `:356-377` เฉพาะเมื่อมีรายการ.
- `database/schema.sql:103-114` และ migration `20261014_room_schema_and_numbers.sql:23-30`: schema ใน repo ไม่มี session/cancel column; migration เก่าลบ session column. **ห้าม apply migration เก่าซ้ำ** เพราะมี DELETE/UPDATE/DROP.

## Evidence — read-only live DB (metadata/aggregate เท่านั้น)

รัน `node C:/Users/sirav/AppData/Local/hermes/cache/scratch/crwn_phase0_readonly.js` ใน repo root; SQL `START TRANSACTION READ ONLY`, SELECT `information_schema.COLUMNS`, `STATISTICS` และ aggregate `COUNT/SUM` เฉพาะ `FITTING_ROOM`, จบด้วย `ROLLBACK`. Exit 0. ไม่พิมพ์ connection config, credential, order ID หรือ row data. ไม่ได้ทดสอบหน้าเว็บ/production flow.

- ตาราง `FITTING_ROOM` มี 7 columns: `FTR_OrderID`, `ITV_SKUID`, `EMP_ID`, `FTR_Number`, `FTR_OrderTime`, `FTR_FinishTime`, `CUS_ID`; ไม่มี `FTR_SessionID`, `FTR_CancelledAt`, `FTR_ReleasedAt`.
- Index ที่เกี่ยวข้อง: `PRIMARY(FTR_OrderID)`, `idx_ftr_room_order(FTR_Number,FTR_OrderTime)` พร้อม index FK ของ `EMP_ID`, `ITV_SKUID`. Repo schema และ live schema ที่ตรวจสอดคล้องกันใน columns/index นี้.
- Aggregate ณ เวลา query: ทั้งหมด 6 แถว, pending ตามเงื่อนไข `FTR_FinishTime IS NULL AND EMP_ID IS NULL` 2 แถว, `FTR_Number` รูป 13-digit barcode 0 แถว. ไม่ได้อ่านรายละเอียดหรือเจ้าของแถว; ไม่ยืนยันว่า pending สองแถวเป็นงานที่แสดงอยู่, active, หรือ legacy จาก flow ไหน. เมื่อเพิ่ม session column แบบ nullable แถวปัจจุบันย่อมเป็น `NULL` จนกว่าจะมีนโยบาย migration แยก.

## Test safety matrix (อ่านไฟล์ก่อนรัน; ไม่มี test ถูก execute ใน Phase 0)

| Command / target | ผล static review | อนุญาตใน phase ถัดไป? |
| --- | --- | --- |
| `USE_MOCK_DB=true npm test` (บน shell Windows ใช้ `USE_MOCK_DB=true npm test`) | `package.json:7` รัน 6 files ที่อ่านครบ; `audit-regression.test.js:7,19,352` mock ก่อน import routes; `test/room-exit.test.js:11-16` mock ก่อน import; อีก 4 files pure resolver/render/in-memory; `database/db.js:12-16,49-75` ปฏิเสธ real pool เมื่อ mock, tests ใช้ local ephemeral HTTP/memory และอ่านไฟล์ | **ผ่าน static safety สำหรับ mock-only** หลัง pre-run status/review test diff อีกครั้ง; ยังไม่ได้รันจริง |
| `USE_MOCK_DB=true npm run test:regression` | ใช้ `tests/audit-regression.test.js` + mock handler | **ผ่าน static safety** เช่นเดียวกัน; ผล test อาจ fail หลังแก้ contract ต้องปรับ test อย่างมีเหตุผล |
| `USE_MOCK_DB=true node --test test/room-exit.test.js` | mock handler และ port loopback; มี assertion เดิมว่า release ไม่แตะ DB (`:166-177`) ซึ่งต้องแก้ก่อน lifecycle ใหม่ | **ผ่าน static safety**; อาจ fail ตาม deliberate contract change |
| `npm run test:integration` / `node --test tests/api.test.js` | `tests/api.test.js:6-17,110-119,279-319,389-416` ต่อ DB จริง, สร้าง order, UPDATE stock, สร้าง receipt; guard เทียบ DB name `s68070186` ไม่ตรง schema ที่ระบุ `s6807186`, และ `ISOLATED_TEST_DB=true` สามารถ bypass guard ได้ | **ห้ามรัน** จนยืนยัน isolated DB ด้วย credentials/test account แยกและ approval ของ write scope; ห้ามใช้ flag bypass กับ shared DB |
| `node server.js`, seed/setup/migration, browser E2E ที่ POST ลง live | แอปเริ่ม initDb และ routes เขียน DB; seed/migration อาจเปลี่ยนข้อมูล | **ห้ามรันกับ shared DB** ใน workflow นี้; migration จริง/production deployment ต้องอนุมัติแยก |

Preflight ไม่ได้ execute `npm test`, `test:integration`, migration, seed, server หรือ browser. ยังไม่พิสูจน์ผล passing/failing ของ suite ปัจจุบัน. Mock suite safety เป็นข้อสรุปจาก source ณ HEAD นี้ ไม่ใช่ใบอนุญาตให้รัน test ใหม่ที่ยังไม่อ่าน.

## Risks / decisions before implementation

1. **Live legacy 6 rows:** อย่าผูก `NULL` session กับ session ใหม่, ลบ, หรือ backfill อัตโนมัติ. ต้องเลือกวิธีดูประวัติและจัดการ pending ที่ยังไม่รับ.
2. **Memory↔MySQL atomicity:** transaction MySQL อย่างเดียวไม่ครอบคลุม memory occupancy. ต้องออกแบบ authoritative session registry/locking/retry และ DB failure handling ก่อนเปลี่ยน release.
3. **TTL / restart:** memory expiry ไม่เรียก DB cleanup; session ใหม่ต้องไม่เห็น/รับงานเก่าแม้ cancelled timestamp ยัง NULL.
4. **Existing behavior:** `test/room-exit.test.js` ยืนยัน release แบบไม่มี body และไม่มี DB calls; contract ใหม่อาจเปลี่ยน behavior นี้. ต้องกำหนด policy ของ older client, staff force-release, และ preparing ก่อน RED test.
5. **Git visibility:** ignored reports และ mock tests อาจหายจาก fresh clone; ต้องเลือก track แบบเจาะจง/ย้ายตำแหน่งโดยได้รับอนุมัติ ห้าม force-add ทั้งโฟลเดอร์ (มี backup/archive).

**Files Changed:** เพิ่มรายงาน Phase 0 นี้ และ draft architecture เท่านั้น; scratch read-only probe อยู่นอก repo. **Tests:** ไม่รัน (Phase 0 only). **Next Action:** review draft contract/choices ใน `02-architecture-and-api-contract.md`; อนุมัติ business policy และ test/write scope ก่อน A01/B02. **Approval Required:** ใช่.
