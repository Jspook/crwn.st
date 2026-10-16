const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// handleLogout must sync the cart (POST) before logout, never DELETE it,
// clear only local caches, and never let a sync failure block logout.

const source = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
const start = source.indexOf('async function handleLogout() {');
const end = source.indexOf('\n// Room Scanner Modal', start);
assert.ok(start >= 0 && end > start, 'handleLogout is present and bounded');
const logoutSource = source.slice(start, end);

function makeHarness(opts = {}) {
  const state = { clearCalled: false, fetches: [] };
  const store = { crwn_cart_u1: '[]', crwn_fitting_items_X: '[]', other_key: 'keep' };
  const items = opts.items !== undefined ? opts.items : [{ sku: 'S1', quantity: 2, price: 100 }];
  const context = {
    fetch: async (url, init = {}) => {
      state.fetches.push({ url, method: init.method, body: init.body });
      if (opts.failCartFetch && url === '/api/cart') throw new Error('network down');
      return { ok: true, json: async () => ({ success: true }) };
    },
    window: {
      Cart: {
        items,
        loadFromStorage() {},
        clear: () => { state.clearCalled = true; },
      },
      location: {},
    },
    localStorage: {
      get length() { return Object.keys(store).length; },
      key: (i) => Object.keys(store)[i] ?? null,
      removeItem: (k) => { delete store[k]; },
    },
    console,
  };
  if (opts.noWindowCart) {
    delete context.window.Cart;
    vm.createContext(context);
    // Mirrors cart.js: top-level const is a script-scope global, not a window property.
    vm.runInContext('const Cart = { items: ' + JSON.stringify(items) + ', loadFromStorage() {}, clear() {} };', context);
  } else {
    vm.createContext(context);
  }
  vm.runInContext(logoutSource, context);
  return { state, store, ctx: context };
}

describe('handleLogout keeps the server cart', () => {
  test('syncs non-empty cart via POST before logout; no clear, no DELETE; local cache purged', async () => {
    const h = makeHarness();
    await h.ctx.handleLogout();

    assert.ok(!h.state.clearCalled, 'Cart.clear must not be called');
    assert.ok(h.state.fetches.every((f) => f.method !== 'DELETE'), 'no DELETE request');

    const cartIdx = h.state.fetches.findIndex((f) => f.url === '/api/cart' && f.method === 'POST');
    const logoutIdx = h.state.fetches.findIndex((f) => f.url === '/api/auth/logout' && f.method === 'POST');
    assert.ok(cartIdx >= 0, 'POST /api/cart recorded');
    assert.ok(logoutIdx >= 0, 'POST /api/auth/logout recorded');
    assert.ok(cartIdx < logoutIdx, 'cart sync happens before logout');

    const body = JSON.parse(h.state.fetches[cartIdx].body);
    assert.equal(body.items[0].sku, 'S1');
    assert.equal(body.items[0].quantity, 2);

    assert.ok(!('crwn_cart_u1' in h.store));
    assert.ok(!('crwn_fitting_items_X' in h.store));
    assert.ok('other_key' in h.store);
    assert.equal(h.ctx.window.location.href, '/');
  });

  test('empty cart: no POST /api/cart, logout still called', async () => {
    const h = makeHarness({ items: [] });
    await h.ctx.handleLogout();
    assert.ok(!h.state.fetches.some((f) => f.url === '/api/cart'));
    assert.ok(h.state.fetches.some((f) => f.url === '/api/auth/logout' && f.method === 'POST'));
  });

  test('Cart as a script-level const global (no window.Cart) is still synced before logout', async () => {
    const h = makeHarness({ noWindowCart: true });
    await h.ctx.handleLogout();
    const cartIdx = h.state.fetches.findIndex((f) => f.url === '/api/cart' && f.method === 'POST');
    const logoutIdx = h.state.fetches.findIndex((f) => f.url === '/api/auth/logout' && f.method === 'POST');
    assert.equal(h.ctx.window.Cart, undefined);
    assert.ok(cartIdx >= 0, 'POST /api/cart recorded');
    assert.ok(cartIdx < logoutIdx, 'cart sync happens before logout');
    assert.equal(JSON.parse(h.state.fetches[cartIdx].body).items[0].sku, 'S1');
  });

  test('cart sync failure does not block logout', async () => {
    const h = makeHarness({ failCartFetch: true });
    await h.ctx.handleLogout();
    assert.ok(h.state.fetches.some((f) => f.url === '/api/auth/logout' && f.method === 'POST'));
    assert.equal(h.ctx.window.location.href, '/');
  });
});
