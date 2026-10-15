# Regression plan / red-capable feedback loops

> Proposed, **not run**. Existing `npm test` runs real database-writing integration tests (`tests/api.test.js:169-253,265-337,375-402`); never run until T00 proves isolated DB target and cleanup. `node --check routes/api.js`, `node --check public/js/app.js`, `node --check public/js/cart.js`, `node --check tests/api.test.js` all passed (syntax only). Live DB + read-only HTTP probes have now been executed successfully ([[08-live-db-verification]]) — those are read-only; the tests below are still **not run**. Use current `node:test` and existing HTTP helper (`tests/api.test.js:25-90`) first; browser/E2E harness may be manual until safe automation exists. Each R-ID below maps to BUG-ID / acceptance criterion; make each test fail on original defect then pass on change.

## Safety/setup

1. Test environment is **separate MySQL database** with explicit DB host/schema fingerprint, abort if equals live config. Never point `npm test` at supplied `.env`. Provision fixtures via approved test-only setup, track created rows, clean in `finally`, and assert row/stock counts restored. Current tests create persistent receipts/finished orders and temporary stock mutation without guaranteed `finally` (`tests/api.test.js:277-295,375-402`); fix test isolation first.
2. Record baseline `git status --short`, Node version, schema migration version/`SHOW CREATE TABLE FITTING_ROOM`, fixture IDs, browser network traces with secrets redacted. Assert DB writes via independent readback, not response only. Use two DB connections for races; fix clock/timezone or use tolerances; don't compare millisecond precision with MySQL DATETIME blindly.
3. Fast loop: one focused `node --test --test-name-pattern='Rxx' tests/api.test.js` **only in isolated env**, then full isolated `npm test`; `node --check` is not behavioral proof. Browser checks on isolated server; no test against live store.

## Test catalog

| Test ID / tier | Bug / criterion | Steps and exact assertion | Original red signal |
| --- | --- | --- | --- |
| R01-U navigation unit | 001 / Back != Exit | simulate Back/Forward and explicit Exit separately; only Exit invokes confirmed release; `pageshow` restores server session | current Back leaves no UI resume |
| R01-E browser | 001 / same-owner resume | scan known room→Back→dashboard→Resume→same `FTR_SessionID`; Refresh and direct URL continue; other user gets 409 | dashboard preflight treats own occupancy as blocked (`app.js:240-250`) |
| R01-F browser/API | 001 / error safety | enter 409/500/timeout does not navigate; release 500/timeout retains page and error; successful Exit releases, re-entry gets new session | ignored fetch status (`app.js:256`; fitting EJS `:302-308`) |
| R02-U image unit | 002 / stable identity | compare image resolver for skirt/bottom/top with GET cart after SKU persistence; never infer `ITM_ID` from 13-digit barcode | GET cart omitted tag/image, cart assigns `top-*` |
| R02-I persistence | 002 / stable before/after | add two distinct product SKUs and multiple colors, reload/new tab/login; image product/category identity unchanged; if no color media spec, assert shared product image not invented color photo | mismatch after server hydrate (`cart.js:54-73`) |
| R02-F integration | 002 / no data loss | replace existing cart with invalid SKU/quantity; error 4xx, old rows unchanged; network failure local UI reconciles with server | delete precedes validation (`api.js:261-271`) |
| R03-U seed fixture | 003 / policy-approved categories | assert exact reviewed IDs' `ITM_Tag` and approved audience; untouched IDs remain unchanged | five `male`/`skirt` seed records (`seed.js:470-540`) |
| R03-I API/read-only live | 003 / correct filter | `GET /api/products?category=male` excludes only IDs policy disallows; compare live `ITEM` data after authorized update; no blanket skirt ban | current API faithfully returns male-tagged skirt rows |
| R04-U modal | 004 / valid pairs only | fixture p1 XL/Black + S/Navy: XL/Navy unavailable; selecting XL exposes only Black; no mock SKU | independent option sets/fallback (`app.js:375-451`) |
| R04-I request/staff | 004 / SKU invariant | POST exact SKU, assert DB row `ITV_SKUID`, GET staff size/color and customer toast match DB; invalid SKU/pair/stock creates no row | current UI sends invalid pair text with fallback SKU |
| R04-R retry/concurrency | 004 / no duplicate | double-click and retry same key; define idempotency policy and assert expected number of rows | `fo_` millisecond IDs, no retry contract |
| R05-I timestamp persistence | 005 / durable time | pending→preparing→complete; DB `FTR_FinishTime` non-null within server-time interval; GET `finishedAt` equal after serialization; failed DB update yields no complete response | GET omits finish time; PATCH response alone falsely passes |
| R05-U/E card | 005 / completion not creation | fixture order time deliberately earlier than finish; complete card uses finish, pending uses created; null finish shows explicit unavailable | card always `createdAt` (`staff/fitting.ejs:150-151`) |
| R05-I transition | 005 / audit immutability | repeat complete must not reset finish; reverse/skip transitions return defined conflict; query after every step, test timezone and order cap newest 5 by finish | `NOW()` overwritten; sorting `FTR_OrderTime` |
| R06-C concurrent DB/API | 006 / single owner | two customers concurrently enter same room on two DB connections; exactly one active session/owner, other 409, no partial `occ_` | SELECT then separate UPDATE/INSERT (`api.js:498-519`) |
| R06-I lifecycle | 006 / scoped release | same owner re-enter returns same session; old session release cannot free newer occupant; staff force-release audited; completed request retained per policy | enter recreates; release updates room-wide |
| R06-R recovery | 006 / stale lock + restart | restart server while room held; DB authoritative; lease or staff recovery after approved grace; DB occupancy query failure responds unavailable/503, never free | occupancy read error becomes empty set (`api.js:457-461`) |
| R07-U resolver | 007 / canonical mapping | each approved QR string (as String) maps to unique logical 1–4; preserve leading zeros; full QR payload only if approved spec; duplicated mapping fails | unknown passes through raw, parser strips chars/defaults 1 |
| R07-I browser/API/DB | 007 / unknown rejection | invalid, unmapped `53636636373363` absent from approved inventory, empty/malformed payload → 4xx/no DB row; room/status/view/staff show same logical room | `/enter` accepts unknown raw room |
| R07-M migration dry run | 007 / legacy safety | compare inventory of legacy `FTR_Number` values before/after approved mapping; zero unmapped active rows and zero data loss; rollback rehearsal | no live DB evidence yet |

## End-to-end path / checkpoints

- R-ALL: QR scan → canonical room → atomic enter/resume → valid variant SKU → staff request → `preparing` → `complete` persisted timestamp → optional cart stable image → explicit release → room available; assert every boundary's ID/session/SKU/timestamp and status.
- Cross-bug: Browser Back must not release room; alternate user cannot enter; same owner can resume; an unrecognized QR cannot reserve phantom room; concurrent enter cannot double-book; completed request must not leak into next customer session; failed cart sync must not erase existing items.
- Coverage gates: unit R02/R04/R07; integration R02/R03/R04/R05/R06/R07; browser R01/R02/R04/R05/R07; DB persistence R02/R05/R06; concurrency R04/R06; recovery R01/R06; navigation R01; variant R04; QR R07; timestamp R05. No existing browser test harness found; use a reviewed browser automation tool or recorded manual trace with expected/actual, not an invented passing result.

## Acceptance sign-off

T00 isolation guard passes; each focused test demonstrably red on original code and green after approved change; full isolated suite passes; no source/DB changes beyond approved scope; live DB read-only reconciliation and migration review completed before deployment. If DNS/credentials/QR spec unavailable, mark affected assertions **blocked/unverified**, not passed. [[04-task-breakdown]] names owners and [[06-execution-order]] sequences gates.
