# Defect Fix Plan

**Project:** crwn.st (Webpor)
**Location:** `c:\Users\sirav\Code\Webpor\crwn.st\crwn.st`

This document outlines a detailed, step‑by‑step remediation plan for the seven defects identified in the previous investigation. Each section lists:
- **Root cause** (as discovered in the investigation report).
- **What to change** (file, function, line range).
- **Implementation steps** (code changes, DB migrations, UI updates, RBAC / security considerations).
- **Testing strategy** (unit / integration tests, updates to existing test suite).
- **Rollback / feature‑flag plan** (if applicable).
- **Estimated effort** and **owner** (placeholder).

---

## Table of Contents
1. [Replace duplicate `ITM_ID` with `ITV_SKUID` in fitting‑room ordering](#defect-1)
2. [Room‑availability status should reflect customer presence, not just pending deliveries](#defect-2)
3. [Prevent customers from adding/removing items when staff has not yet delivered them](#defect-3)
4. [Show only the five most recent delivered items in staff fitting view](#defect-4)
5. [Disallow entry into occupied rooms](#defect-5)
6. [Enforce staff‑only visibility and action on their own orders](#defect-6)
7. [Separate scanning and payment UI in cashier page](#defect-7)

---

## <a id="defect-1"></a>1. Duplicate `ITM_ID` → use `ITV_SKUID`
### Root Cause
- Front‑end `fitting-room.ejs` passes `item.ITM_ID` to the order API (`openItemRequest('<%= item.ITM_ID %>')`).
- The back‑end API (`routes/api.js` → `POST /api/fitting-orders`) expects `ITV_SKUID`. When an `ITM_ID` is supplied, the server falls back to the first variant of the product, leading to duplicate IDs.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `views/customer/fitting-room.ejs` | line ~80 | Replace `ITM_ID` with `ITV_SKUID` when calling `openItemRequest`.
| `routes/api.js` | function `createFittingOrder` (lines 340‑380) | Add validation that the supplied SKU exists in `ITEM_VARIANT`. Return 400 if not found.
| `database/schema.sql` | (optional) Add unique index on `ITV_SKUID` if not already present.

### Implementation Steps
1. **Frontend**: Edit the EJS template to use `<%= item.ITV_SKUID %>`.
2. **Backend**: 
   - Validate `req.body.sku` against `ITEM_VARIANT` table.
   - If not found, respond with `{ error: "Invalid SKU" }` and status 400.
   - Remove fallback logic that selects the first variant.
3. **Database**: Verify a unique constraint on `ITV_SKUID`; add if missing:
   ```sql
   ALTER TABLE ITEM_VARIANT ADD CONSTRAINT uq_itv_skuid UNIQUE (ITV_SKUID);
   ```
4. **Feature Flag**: Wrap validation behind a flag `ENABLE_STRICT_SKU` (default `true`). Allows quick rollback if integration issues arise.

### Security / RBAC
- No new security concerns; validation prevents injection of arbitrary IDs.

### Testing Strategy
- **Unit**: Add test in `tests/test_defects.js` verifying API returns 400 for unknown SKU.
- **Integration**: End‑to‑end test that the UI sends the correct field and order is created.
- Update existing defect‑test suite to assert the new validation.

### Rollback Plan
- Feature flag can be toggled off to revert to previous behaviour.
- Database migration is additive; adding a unique index will fail only if duplicates already exist – run a pre‑migration script to deduplicate.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 2 dev days | *(TBD)* |

---

## <a id="defect-2"></a>2. Room‑availability status should depend on customer presence
### Root Cause
- `GET /api/fitting-rooms` builds `FTR_Status` based solely on whether there are *undelivered* items (`FTR_FinishTime` is NULL).
- When a customer leaves the room after all items are delivered, the room remains shown as **occupied** because the DB does not record the customer‑presence flag.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `database/schema.sql` | Add column `FTR_CustomerPresent TINYINT(1) DEFAULT 0` to `FITTING_ROOM`.
| `routes/api.js` | `GET /api/fitting-rooms` (lines ~500‑530) – include `FTR_CustomerPresent` in status logic.
| `public/js/app.js` | `fetchFittingRoomsStatus()` – disable room button when `FTR_CustomerPresent` is true.
| `routes/api.js` | `POST /api/fitting-enter` (new endpoint) – set `FTR_CustomerPresent = 1` when a customer enters.
| `POST /api/fitting-exit` (new endpoint) – set `FTR_CustomerPresent = 0` when a customer leaves.

### Implementation Steps
1. **DB Migration**: Create a migration script (SQL file `migrations/20241001_add_customer_present.sql`).
2. **API**: Add two new endpoints (`/api/fitting-enter/:roomId`, `/api/fitting-exit/:roomId`) that toggle the flag; protect them with authentication middleware.
3. **Status Logic**: Modify status calculation:
   ```js
   const isOccupied = room.FTR_CustomerPresent === 1;
   const status = isOccupied ? 'Occupied' : 'Available';
   ```
4. **Frontend**: In `app.js`, when rendering room buttons, add `disabled` attribute if `isOccupied`.
5. **Feature Flag**: `ENABLE_ROOM_OCCUPANCY` to allow gradual rollout.

### Security / RBAC
- New endpoints must verify the caller is a *customer* session (role `customer`).
- Ensure CSRF protection for state‑changing calls.

### Testing Strategy
- **Unit**: Test migration script on a fresh DB copy.
- **Integration**: Simulate customer entering/exiting a room and assert the status changes.
- Extend `tests/test_defects.js` with new test cases for the two endpoints.

### Rollback Plan
- Feature flag disabled reverts to original behaviour; column defaults to `0` so no data loss.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 3 dev days + 1 QA day | *(TBD)* |

---

## <a id="defect-3"></a>3. Prevent customers from modifying cart before staff delivery
### Root Cause
- The client‑side cart (`sessionTriedItems` in localStorage) allows `addItem` / `removeItem` regardless of order status.
- No server‑side guard; staff can still mark an order as `pending` while the customer continues to edit.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `public/js/app.js` | Functions `addItemToCart`, `removeItemFromCart` – add check `if (order.status !== 'pending') return;`.
| `routes/api.js` | `PATCH /api/fitting-orders/:id` – reject updates to `items` if `status === 'preparing'` or `complete`.
| `views/customer/fitting-room.ejs` | Disable “Add to cart” button when order status is not `pending`.

### Implementation Steps
1. **Frontend**: Add a flag `orderEditable` retrieved from the order API. Hide/disable UI controls when false.
2. **Backend**: In the PATCH handler, verify the requested mutation is allowed; if not, respond with 403.
3. **Security**: Ensure the check uses the authenticated employee ID for staff actions; customers cannot bypass via manual API calls.
4. **Feature Flag**: `ENABLE_CART_LOCK`.

### Testing Strategy
- Add unit tests for the PATCH endpoint rejecting illegal updates.
- UI tests (e.g., using Cypress) to verify button disabling.
- Update existing defect suite to assert cart cannot be modified after staff marks `preparing`.

### Rollback Plan
- Feature flag off restores previous permissive behaviour.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 2 dev days + 1 QA day | *(TBD)* |

---

## <a id="defect-4"></a>4. Show only the five most recent delivered items in staff view
### Root Cause
- `views/staff/fitting.ejs` renders all `complete` cards (`orderList.filter(o => o.status === 'complete')`). No limit applied.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `views/staff/fitting.ejs` | Loop that renders `complete` column – apply `.slice(0,5)` after sorting by `FTR_FinishTime` descending.
| `routes/api.js` | `GET /api/fitting-orders` – add optional query param `?limit=5` for the `complete` status.

### Implementation Steps
1. **Backend**: Modify the DB query to order by `FTR_FinishTime DESC` and limit to 5 when `status='complete'` and `limit` param is present.
2. **Frontend**: Update the rendering logic to request the limited list (`fetch('/api/fitting-orders?status=complete&limit=5')`).
3. **Feature Flag**: `ENABLE_COMPLETE_LIMIT`.

### Security / RBAC
- No new concerns; endpoint remains staff‑only.

### Testing Strategy
- Add unit test ensuring the API returns at most 5 rows when the limit param is used.
- UI test confirming only 5 cards appear.

### Rollback Plan
- Disable the flag; revert to full list.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 1.5 dev days | *(TBD)* |

---

## <a id="defect-5"></a>5. Disallow entry into occupied rooms
### Root Cause
- `public/js/app.js` builds room buttons but does not set `disabled` attribute for occupied rooms; click handler still navigates.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `public/js/app.js` | `renderRoomButtons()` – add `disabled` attribute and CSS class when `room.isOccupied`.
| `views/customer/fitting-room.ejs` | (optional) Show a tooltip explaining why the room is unavailable.

### Implementation Steps
1. Update the room‑status API to include `isOccupied` (derived from `FTR_CustomerPresent`).
2. Modify UI rendering to disable button and prevent `selectRoom()` execution.
3. Add a user‑friendly message.
4. Feature flag `ENABLE_ROOM_ENTRY_GUARD`.

### Security / RBAC
- No server changes; purely UI guard.

### Testing Strategy
- UI test attempting to click an occupied room and expecting no navigation.
- Unit test for `renderRoomButtons` output.

### Rollback Plan
- Turn off flag.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 1 dev day | *(TBD)* |

---

## <a id="defect-6"></a>6. Staff order visibility and action isolation
### Root Cause
- `GET /api/fitting-orders` returns all orders regardless of `EMP_ID`.
- `PATCH /api/fitting-orders/:id` does not verify that the requesting employee matches the order’s `EMP_ID`.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `routes/api.js` | `GET /api/fitting-orders` – add filter `WHERE EMP_ID = :currentEmpId` when the caller is staff.
| `routes/api.js` | `PATCH /api/fitting-orders/:id` – verify `order.EMP_ID === currentEmpId`; otherwise return 403.
| `views/staff/fitting.ejs` | Ensure the front‑end only requests orders for the logged‑in employee.

### Implementation Steps
1. **Auth Middleware**: Expose `req.user.id` (employee ID) from `auth.js`.
2. **Order List Endpoint**: Accept optional query `?myOnly=true`; if present, add `WHERE EMP_ID = req.user.id`.
3. **Patch Endpoint**: Add guard:
   ```js
   if (order.EMP_ID !== req.user.id) {
     return res.status(403).json({ error: 'Forbidden' });
   }
   ```
4. **Frontend**: When loading the Kanban, request `/api/fitting-orders?myOnly=true`.
5. **Feature Flag**: `ENABLE_STAFF_RBAC`.

### Security / RBAC
- This is a critical security fix (OWASP “Broken Access Control”).
- Ensure CSRF tokens are validated for state‑changing calls.

### Testing Strategy
- Add unit tests that a staff member cannot PATCH another employee’s order (expect 403).
- Integration test verifying the staff UI only shows their own orders.
- Update `test_defects.js` with new cases.

### Rollback Plan
- Feature flag off re‑exposes all orders (only for debugging environments).

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 2.5 dev days + 1 QA day | *(TBD)* |

---

## <a id="defect-7"></a>7. Separate scanning and payment UI in cashier page
### Root Cause
- `views/staff/cashier.ejs` combines barcode scanner, cart summary, and payment method selection on a single page.
- Test cases require distinct screens.

### What to Change
| File | Location | Change |
|------|----------|--------|
| `views/staff/cashier.ejs` | Split into two components: `cashier_scan.ejs` (left side) and `cashier_payment.ejs` (right side, hidden initially).
| `public/js/app.js` | Add navigation logic: after scanning & confirming total, hide scan component and show payment component.
| Routes: `GET /cashier/scan` and `GET /cashier/payment` – separate endpoints (optional).
| CSS/HTML: Adjust layout to place total on the right side.

### Implementation Steps
1. **Create new view** `cashier_payment.ejs` containing only payment method radio buttons and a “Pay” button.
2. **Refactor existing `cashier.ejs`** to include both components but show only the scan component initially.
3. **JS**: On “Proceed to payment” click, hide scan area (`#scanSection`) and display `#paymentSection`.
4. **Routing**: Keep a single route (`/staff/cashier`) that renders the combined page; no new server routes required.
5. **Feature Flag**: `ENABLE_SEPARATE_CASHIER_UI`.

### Security / UX
- Ensure the total amount is calculated server‑side and passed as a hidden field to avoid tampering.
- Add input validation for payment method.

### Testing Strategy
- Update UI tests to verify transition between screens.
- Add unit test for total calculation endpoint.
- Extend `test_defects.js` to simulate the full checkout flow across both pages.

### Rollback Plan
- Disable flag; revert to original monolithic page.

### Estimated Effort & Owner
| Effort | Owner |
|--------|-------|
| 2 dev days + 0.5 QA day | *(TBD)* |

---

## Cross‑Cutting Considerations
1. **Feature‑Flag Framework** – Use existing `config/featureFlags.js` (or create if absent) to toggle each fix independently.
2. **Documentation** – Update `README.md` with new API endpoints and UI behavior.
3. **CI / Lint** – Ensure all new files pass ESLint (`eslint-config-airbnb-base`) and Prettier.
4. **Performance** – The added DB column and limited queries are indexed; add index on `FTR_CustomerPresent` for fast lookup.
5. **Rollback Strategy** – All changes are guarded by feature flags; deployments should be performed via CI pipeline with canary release.

---

## References
- **Defect Investigation Report**: [defect_investigation_report.md](file:///C:/Users/sirav/.gemini/antigravity/brain/7e9b346f-9620-4660-bd55-eb382aa40940/defect_investigation_report.md)
- **Test Suite**: `c:\Users\sirav\Code\Webpor\crwn.st\crwn.st\tests\test_defects.js`
- **Project Root**: `c:\Users\sirav\Code\Webpor\crwn.st\crwn.st`

---

*Prepared by Antigravity – adhering to OWASP Top 10, SOLID principles, and the project’s security & code‑quality policies.*
