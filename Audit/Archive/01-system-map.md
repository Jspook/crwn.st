# crwn.st — System map (read-only audit)

> Scope: repository `AIOS/03 Projects/crwn.st` at `main` (`1804205`), clean working tree before audit. Source of truth here is inspected code, **cross-checked against the live database and a live server boot on 2026-10-14** — see [[08-live-db-verification]] (MySQL 8.0.46 / DB `s68070186` / 11 tables / read-only). No source/DB changes authorized. See [[02-bug-investigation]] and [[03-root-cause-and-fix-plan]].

## Repository / stack

```text
server.js                 Express 5 startup, middleware, static files, EJS routes
routes/auth.js            login/register/logout
routes/views.js           customer/staff rendered pages and room-session gate
routes/api.js             products, barcode, cart, fitting rooms/orders, receipts
middleware/auth.js        signed-cookie identity/role guards
database/db.js            mysql2/promise pool, query/get/run/withTransaction
database/schema.sql       MySQL DDL; migrations/{20241001...,20261005...}.sql
database/seed.js          destructive reseed (DO NOT RUN against live DB)
utils/productImages.js    tag + product-ID parity → mock category picture
public/js/{app,cart}.js   QR/barcode/request UI; localStorage-backed cart
views/customer/*.ejs      dashboard, fitting-room, checkout, receipt
views/staff/*.ejs         fitting Kanban, cashier
views/partials/*.ejs      navbar, room/request/cart UI
tests/api.test.js         node:test integration tests against configured DB
```
`package.json:5-24` declares Node >=22, Express/EJS, mysql2, native `node:test`, `npm test`; `sqlite3` is installed but `database/db.js:6-22` uses MySQL. `server.js:63-93` mounts `/api/auth`, `/api`, and view routes, and checks DB on startup. `README.txt` documents setup but contains committed credentials: do **not** copy them into reports; rotate/revoke after coordination and remove from tracked history by approved security process. No repo-specific AGENTS.md/CLAUDE.md found up to vault root; no pre-existing `Audit/` directory. README statements about live DB are not live evidence.

## Schema (DDL, not verified live)

| Table | Pertinent fields / relationship |
| --- | --- |
| `ITEM` | `ITM_ID` PK, `ITM_Category` (audience in seed), `ITM_Tag` (garment type); `schema.sql:29-37` |
| `ITEM_VARIANT` | `ITV_SKUID` PK, `ITM_ID` FK, `ITV_Color`, `ITV_Size`, `ITV_Stock`; `:50-60` |
| `PAY_CART`, `PAY_CART_ITEM` | customer cart and one row per SKU unit; `:62-76` |
| `FITTING_ROOM` | `FTR_OrderID` PK, nullable `ITV_SKUID` (NULL for `occ_` sentinel), `FTR_Number` varchar, `FTR_OrderTime`, `FTR_FinishTime`, `FTR_CustomerPresent`, `FTR_SessionID`, `CUS_ID`, `FTR_ReleasedAt`; `:102-117`; indexes `:126-127` |
| `SALE_ORDER`, `SALE_ORDER_LINE` | completed sales/stock flow, not garment-delivery events; `:78-100` |
| `CUSTOMER`, `EMPLOYEE`, `LOCATION` | identity/roles/storage references; `:9-27,39-46` |

Migrations add presence and session/owner/released columns; `CREATE TABLE IF NOT EXISTS` and ad hoc migrations do not establish that live schema matches. No unique active-room constraint, explicit room-registry table, dedicated occupancy table, or fitting status column in checked DDL. Status is inferred from `FTR_FinishTime` then `EMP_ID` (`routes/api.js:351-357`). `database/db.js:48-79` has transaction helper, but fitting enter/release/cart/status routes currently use separate `run` calls.

## Actual route map (principal)

| Method/path | Role/function | Evidence |
| --- | --- | --- |
| GET `/customer/dashboard`, `/customer/fitting-room` | customer catalog; fitting page requires active `FITTING_ROOM` row | `routes/views.js:69-149` |
| GET `/staff/fitting` | staff Kanban UI | `routes/views.js` / `views/staff/fitting.ejs` |
| GET `/api/products`, `/api/products/barcode/:code` | item + variant list, exact barcode lookup, mock image | `routes/api.js:16-194` |
| GET/POST/DELETE `/api/cart` | cart join/group; replace rows; clear | `routes/api.js:200-306` |
| GET `/api/fitting-rooms` | static four barcodes + occupancy query | `routes/api.js:453-487` |
| POST `/api/fitting-rooms/:roomId/enter`, `/release` | create `occ_` sentinel/session, release occupancy/orders | `routes/api.js:489-554` |
| GET/POST `/api/fitting-orders`, PATCH `/api/fitting-orders/:id` | session-scoped request list/create, staff transition | `routes/api.js:343-450,556-706` |
| `/api/receipts` | checkout/sales, separate from garment delivery | `routes/api.js:708+` |

## Data flow and coupling

```text
QR raw text (app.js:196-207) → digit extraction → selectRoom()
 → GET room occupancy → POST /enter → INSERT FITTING_ROOM occ_ + ses_
 → fitting-room view resolves session by room+customer+presence
 → catalog ITEM + ITEM_VARIANT → independent size/color UI → SKU fallback
 → POST /fitting-orders (SKU authoritative) → FITTING_ROOM order row
 → staff GET join SKU → PATCH pending/preparing/complete (finish time)
 → explicit exit → optional Cart.addItem → POST /cart → POST /release
```
Room mapping is duplicated in `routes/api.js:317-340`, `routes/views.js:88-108` and `views/customer/fitting-room.ejs:1-12`. `ROOM_BARCODES` lists four known strings. Unknown IDs pass `normalizeRoomId` unchanged; display uses suffix fallback. `FTR_Number` currently stores external barcode rather than canonical logical room number; `roomDisplay` is calculated. No QR generator/spec found in checked repository; `BarcodeDetector` scanner is in `public/js/app.js`. Browser Back/brand navigation does not call explicit exit; same-owner room remains occupied and dashboard preflight blocks re-entry. `GET /api/fitting-rooms` catches DB read failures and returns empty occupancy (`routes/api.js:457-461`).

Product images are *mock* tag/parity images, not item/variant-specific persisted media (`utils/productImages.js:6-25`). `GET /api/cart` omits image/productId (`routes/api.js:216-241`), then `Cart.init` assigns `top-1/2.jpg` by SKU digit-parsing (`public/js/cart.js:54-73`). Thus cart persistence can change images for skirts/bottoms and cannot promise color-accurate media without a product-image data source. Staff request uses DB SKU join, while optimistic customer text/localStorage can use unmatched UI size/color (`app.js:440-495`).

## Boundaries / verification

**Verified live (2026-10-14, read-only):** MySQL 8.0.46 on `webdev.it.kmitl.ac.th` (`10.0.30.22`) / DB `s68070186`; 11 tables (10 designed + unexpected `student_score`); `ITEM` 67 / `ITEM_VARIANT` 96 / `FITTING_ROOM` 14 / `SALE_ORDER` 21 / `CUSTOMER` 56 / `EMPLOYEE` 53; all 96 SKUs are 13-digit; `FITTING_ROOM` columns and indexes confirmed directly (see [[08-live-db-verification]]). Server boots and serves read-only endpoints correctly (`.env` present, `COOKIE_SECRET` 64 chars). **Still unverified:** browser interactions (Back/Refresh/BFCache/two-tab), concurrent `/enter` race, production QR payload specification, per-color product photography, and the shared `student_score` table's provenance. `npm test` is unsafe on this DB: tests create fitting rows and sale orders, mutate stock, and do not comprehensively clean up (`tests/api.test.js:169-253,265-337,375-402`). `node --check` passed on `routes/api.js`, `public/js/app.js`, `public/js/cart.js`, `tests/api.test.js`; this is syntax checking, **not** behavioral test success.

## เอกสารเชื่อมโยง

[[02-bug-investigation]] (หลักฐานแต่ละ Bug), [[03-root-cause-and-fix-plan]] (แนวทาง), [[05-regression-test-plan]] (แผนทดสอบ), [[06-execution-order]] (ลำดับงาน).
