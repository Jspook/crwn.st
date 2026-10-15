# Handoff to lower-cost coding model — HOLD / no approved tasks

**Approval state:** `approved_task_ids = []`. This is a reusable handoff template, **not** permission to modify code or DB. Wait for owner to approve explicit T-IDs, scope, DB isolation, and policy gates in [[06-execution-order]]. Never run `setup-db.js`, `database/seed.js`, or `npm test` against repository `.env`; tests mutate DB. Preserve uncommitted work and do not print credentials/PII.

## Minimal context

Repo `AIOS/03 Projects/crwn.st`, Node >=22 + Express 5/EJS + MySQL (`server.js`, `routes/api.js`, `routes/views.js`, `database/db.js`, `database/schema.sql`); native node:test `tests/api.test.js`. Fitting session and request rows currently share `FITTING_ROOM`; `occ_` is NULL-SKU occupancy sentinel, `FTR_Number` stores barcode-like room string; staff status inferred from `EMP_ID` and `FTR_FinishTime`. **Live DB (MySQL 8.0.46 / `s68070186`) and read-only HTTP contracts verified 2026-10-14 — see [[08-live-db-verification]] for the confirmed schema, the 5 male-skirt IDs, the p1 variant pairs, the cart response shape, and the DB timezone inconsistency; browser and concurrency behavior still unverified and `npm test` still unsafe on the live DB.** Read task spec [[04-task-breakdown]] for assigned ID and only relevant BUG section in [[02-bug-investigation]] plus [[05-regression-test-plan]]; do not ingest whole audit unless blocked.

| Task | Only after approval: read these files / code-level root cause |
| --- | --- |
| T00 | `tests/api.test.js`, `database/db.js`, `database/schema.sql`; current tests write orders/cart/stock to configured DB; first establish separate test target with fail-safe guard. |
| T07 | `routes/api.js:317-340,455-554`, `routes/views.js:88-116`, `public/js/app.js:196-260`; mapping copied, unknown QR accepted; raw strings preserved. Need actual physical QR inventory/legacy IDs first. |
| T06 | `routes/api.js:489-554`, `database/db.js:48-79`, `schema.sql:102-127`; enter/release nontransactional, room-wide release, no unique active occupancy. Needs T07 + lease/schema approval. |
| T01 | `public/js/app.js:227-265`, `views/customer/fitting-room.ejs:270-308,406-421`, `views/customer/dashboard.ejs`, `routes/views.js:86-149`; Back leaves DB session, dashboard blocks own room; explicit release/enter errors ignored. Needs T06 contract. |
| T04 | `public/js/app.js:375-495`, `routes/api.js:556-647`, `views/staff/fitting.ejs:150-198`, `database/seed.js:607-623`; independent size/color produces nonexistent pair; fallback SKU differs from selected text. |
| T05 | `routes/api.js:343-450,649-706`, `views/staff/fitting.ejs:91-151`, `schema.sql:103-113`; DB schema **already has** `FTR_FinishTime` and PATCH sets it; GET/UI omit it, repeat complete rewrites. Do not add column without live schema evidence. |
| T02 | `routes/api.js:200-306`, `public/js/cart.js:49-142`, `utils/productImages.js:6-25`; GET cart omits product/tag/image then browser guesses top image from numeric SKU; POST deletes old rows before validation. No real color photos established. |
| T03 | `database/seed.js:463-540,600-604`, `routes/api.js:16-45`; p52/p54/p56/p58/p60 have male+skirt in seed. Business policy and live DB must be checked; never reseed. |

## Work protocol per approved T-ID

1. Re-read assigned code and `git status`; confirm no file overlap with concurrent branch. Confirm isolated DB endpoint through redacted fingerprint/abort guard. Form failing, symptom-specific test on that DB; run to show RED before fix.
2. Implement smallest approved invariant (no broad refactor). Preserve API compatibility/migration staging. If schema/data change is proposed but unapproved, stop and report rather than guessing.
3. Run focused node:test test, DB readback, browser/concurrency test as task requires; then full `npm test` **only in isolated env**. Record exact commands, exit codes, failed assertions; never claim tests pass without executing. Check Git diff and unapproved file changes.
4. Return: task ID, observed root cause/remaining uncertainty, changed files/functions, DB change/row counts (if approved), test command/output, acceptance criterion results, rollback/recovery plan, security/legacy risks. Do not implement other T-IDs opportunistically.

## Global acceptance invariants

Exact SKU and size/color match customer/staff/DB; unknown QR cannot create a room; only one active owner per logical room; same owner resumes after Back; explicit Exit releases only its session; complete time is persisted once and presented as completion time; rehydrated cart retains correct product/category mock image. Actual variant-color photo mapping and merchandising classification require separate verified specs. All tasks await user approval.

## เอกสารเชื่อมโยง

[[02-bug-investigation]] (evidence), [[04-task-breakdown]] (complete task scope), [[05-regression-test-plan]] (R-IDs), [[06-execution-order]] (gates).
