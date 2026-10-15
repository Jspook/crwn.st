const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Bug A — customer exit warning must fail closed.
// Contract (Audit/02-architecture-and-api-contract.md §8):
//   GET /api/fitting-orders?roomId=<barcode> -> 200 array for the active session.
//   pending/preparing -> render warning before release.
//   200 [] -> no-orders native confirm (may release on confirm).
//   4xx/5xx/network error/invalid (non-array) payload -> fail closed:
//     NO release, NO no-orders confirm.
//   cancel -> no release. release failure -> no navigation.
// Mock/isolated only; no browser, no shared DB.

const viewPath = path.join(__dirname, '../views/customer/fitting-room.ejs');
const source = fs.readFileSync(viewPath, 'utf8');

const start = source.indexOf('  async function confirmExitFittingRoom() {');
const end = source.indexOf('\n  async function releaseCurrentRoom()', start);
assert.ok(start >= 0 && end > start, 'confirmExitFittingRoom function is present and bounded');

const confirmSource = source.slice(start, end);

function makeHarness(opts = {}) {
  const state = { releaseCalls: 0, alerts: [], rendered: null, cleared: 0 };
  const context = {
    currentRoomId: '5684848452325',
    currentRoomDisplay: '1',
    validCompletedOrders: [],
    fetch: opts.fetchImpl || (async () => ({ ok: true, json: async () => [] })),
    confirm: () => (opts.confirm !== undefined ? opts.confirm : true),
    alert: (m) => state.alerts.push(m),
    releaseCurrentRoom: async () => {
      state.releaseCalls += 1;
      return opts.release !== undefined ? opts.release : true;
    },
    renderExitItemsList: (completed, undelivered) => {
      state.rendered = { completed, undelivered };
    },
    clearTriedFittingItems: () => { state.cleared += 1; },
    window: { location: {}, lucide: undefined },
    document: { getElementById: () => ({ classList: { remove() {}, add() {} } }) },
    console,
  };
  vm.runInNewContext(confirmSource, context);
  return { state, call: () => context.confirmExitFittingRoom(), ctx: context };
}

const okArray = (arr) => async () => ({ ok: true, status: 200, json: async () => arr });

describe('customer exit warning — fail closed (Bug A)', () => {
  test('200 with pending/preparing items renders the warning and does NOT release', async () => {
    const h = makeHarness({
      fetchImpl: okArray([
        { sku: 'a', status: 'pending', productName: 'Tee', size: 'S', color: 'Black' },
        { sku: 'b', status: 'preparing', productName: 'Shirt', size: 'M', color: 'White' },
      ]),
    });
    await h.call();
    assert.ok(h.state.rendered, 'warning list is rendered');
    assert.equal(h.state.rendered.undelivered.length, 2);
    assert.equal(h.state.rendered.completed.length, 0);
    assert.equal(h.state.releaseCalls, 0, 'must not release when undelivered items exist');
  });

  test('200 [] shows no-orders confirm and releases only on confirm', async () => {
    const h = makeHarness({ fetchImpl: okArray([]), confirm: true });
    await h.call();
    assert.equal(h.state.releaseCalls, 1, 'releases after user confirms no-orders exit');
    assert.equal(h.ctx.window.location.href, '/customer/dashboard');
  });

  test('200 [] with cancelled confirm does not release', async () => {
    const h = makeHarness({ fetchImpl: okArray([]), confirm: false });
    await h.call();
    assert.equal(h.state.releaseCalls, 0, 'cancel must not release');
  });

  for (const status of [400, 403, 404, 409, 500, 503]) {
    test(`HTTP ${status} fails closed: no release, no no-orders confirm, user warned`, async () => {
      const h = makeHarness({ fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: 'x' }) }) });
      await h.call();
      assert.equal(h.state.releaseCalls, 0, `no release on HTTP ${status}`);
      assert.equal(h.state.rendered, null, 'no warning modal on failure');
      assert.ok(h.state.alerts.length >= 1, 'user is told the check failed');
    });
  }

  test('network error fails closed', async () => {
    const h = makeHarness({ fetchImpl: async () => { throw new Error('network down'); } });
    await h.call();
    assert.equal(h.state.releaseCalls, 0);
    assert.ok(h.state.alerts.length >= 1);
  });

  test('invalid (non-array) 200 payload fails closed', async () => {
    for (const bad of [{}, 'nope', null, 42]) {
      const h = makeHarness({ fetchImpl: okArray(bad) });
      await h.call();
      assert.equal(h.state.releaseCalls, 0, `no release on invalid payload ${JSON.stringify(bad)}`);
      assert.ok(h.state.alerts.length >= 1, 'user is told the check failed');
    }
  });

  test('release failure after confirmed no-orders exit prevents navigation', async () => {
    const h = makeHarness({ fetchImpl: okArray([]), confirm: true, release: false });
    await h.call();
    assert.equal(h.state.releaseCalls, 1);
    assert.equal(h.ctx.window.location.href, undefined, 'must not navigate when release fails');
    assert.equal(h.state.cleared, 0, 'must not clear local state when release fails');
  });
});