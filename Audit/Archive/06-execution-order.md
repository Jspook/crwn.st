# Execution order / dependency graph (proposed)

> **STOP at plan.** Nothing below authorizes implementation. Root-cause confidence and missing evidence: [[02-bug-investigation]]. Tests: [[05-regression-test-plan]].

```text
User approves plan + safe test DB / live read-only inventory
                  │
                  ▼
          T00 isolation + red repro
                  │
     ┌────────────┼────────────────────────────┐
     ▼            ▼                            ▼
T07 QR registry  T04 exact SKU               T05 finish time
     │            │                            │
     ▼            └─────────┬──────────────────┤
T06 atomic room            T02 cart image      │
     │                      │                   │
     ▼                      └──── integration ──┘
T01 Back/resume/exit               │
     │                             │
     └─────────── full E2E ─────────┘
                 ▲
T03 category correction after merchandising + live data approval
```

**Priority by impact, not simplicity:** (1) T07/T06 room identity/atomic ownership: High/Critical availability and duplicate-room risk; (2) T01 re-entry after server contract; (3) T04 wrong garment request, High; (4) T05 event timestamp/audit, Medium–High; (5) T02 cart identity/sync, Medium; (6) T03 merchandising data, Medium pending policy. T04 can start alongside T07 if it does not edit shared `routes/api.js` simultaneously; merge serially and rerun tests. T05/T02 likewise touch API; use distinct branches/worktrees and integrate one at a time. T03 data **writes** only after exact inventory/policy approval.

## Stages / gates

| Stage | Work | Required checkpoint | Approval needed |
| --- | --- | --- | --- |
| G0 | T00 isolated MySQL + all read-only inventory (QR payload, legacy rows, photo policy, baseline) | DB fingerprint proves not live; tight red-capable repro; status documented. **Already read-only-verified 2026-10-14:** schema/columns/indexes, 5 male-skirt IDs, p1 variant pairs, cart contract, staff Kanban state, timezone inconsistency ([[08-live-db-verification]]) — remaining live gap is physical QR payload + browser behavior | user supplies/approves isolated test DB and inventory access |
| G1 | T07 canonical resolver, reject unknown IDs | four real QR↔room mappings agreed; invalid QR cannot write row; legacy compatibility reviewed | physical QR inventory, alias/legacy mapping; schema if registry chosen |
| G2 | T06 atomic enter/resume/release and recovery | two-client race, same-owner resume, zero cross-session release, DB outage fail-closed | occupancy/lease/staff force-release semantics; any migration and rollback |
| G3 | T01 navigation UX | Back/Forward/Refresh preserve session; Exit commits release and error path safe | accept UX for Resume/Exit |
| G4 | T04, T05, T02 independent coding/testing after T00; integrate sequentially | exact SKU parity; immutable finish time; stable cart image+atomic sync | duplicate request policy; image specification; transition policy/timezone |
| G5 | T03 approved targeted classification corrections | precise IDs/old values and affected-row count; no reseed | merchandising and live data mutation approval |
| G6 | full isolated regression + staged deploy review | R-ALL path, concurrency/restart, DB readback, legacy/rollback rehearsal | release/migration authorization |

**Why this order:** `FTR_Number` normalization must be stable before constraining occupancy. T06 establishes session contract before T01 UI resume; otherwise UI workaround can create duplicate sessions. T04 validates variant independent of cart image. T05 completion event distinct from room release. No blanket database cleanup until provenance and retention policy known.

## Parallelism / conflict control

- Read-only investigations (live schema/classification/QR physical inventory) can proceed together; avoid reporting secrets/customer identities. T04/T05/T02 coding may proceed in parallel only on isolated branches or assigned nonoverlapping hunks of `routes/api.js`; their UI files differ. Integrate one branch, rerun focused+full isolated tests, then next.
- T07 → T06 → T01 is serial by contract. T03 can be independent only after business approval; any schema/live correction is serialized with rollout/migration.
- Explicit checkpoints: clean/dirty Git status preservation, before/after schema and row counts, focused regression output, full suite output, browser/network trace, rollback rehearsal. If an expected count differs, stop; never force migration or silently adjust.

## Rollout / rollback

Deploy additive response/compatibility reads before any schema/write switch; back up DB with owner-approved procedure; verify old `FTR_Number`/`occ_` rows and active sessions. Migrate by approved exact mapping; rollback application/read path without discarding newly created sessions/orders. Stop rollout if 409 rate spikes, unknown QR errors exceed inventory expectation, duplicate occupancy observed, timestamp nulls on new completes, or cart images diverge. No production operations are performed by this audit.

## เอกสารเชื่อมโยง

[[01-system-map]], [[03-root-cause-and-fix-plan]], [[04-task-breakdown]], [[07-handoff-to-coding-model]].
