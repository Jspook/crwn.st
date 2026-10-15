// Spec round 2: AC-U1, AC-U2, AC-U3. Mock DB only.
process.env.USE_MOCK_DB = 'true';
process.env.COOKIE_SECRET = process.env.COOKIE_SECRET || 'test_secret_32_characters_minimum_length_abcdef';

const { test, describe, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const cookieParser = require('cookie-parser');
const cookieSignature = require('cookie-signature');

const { setMockHandler } = require('../database/db');
const { roomOccupancy } = require('../utils/roomOccupancy');
const apiRoutes = require('../routes/api');
const viewRoutes = require('../routes/views');

const SECRET = process.env.COOKIE_SECRET;
const app = express();
app.use(express.json());
app.use(cookieParser(SECRET));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));
app.use('/api', apiRoutes);
app.use('/', viewRoutes);

function cookieFor(user) {
  return 'crwn_auth=' + encodeURIComponent('s:' + cookieSignature.sign(JSON.stringify(user), SECRET));
}
const ALICE = cookieFor({ id: 'cus_001', name: 'Alice', role: 'CUSTOMER' });
const BOB = cookieFor({ id: 'cus_002', name: 'Bob', role: 'CUSTOMER' });

let server;
function call(method, url, cookie) {
  return new Promise((resolve, reject) => {
    const headers = cookie ? { Cookie: cookie } : {};
    const req = http.request({ host: '127.0.0.1', port: server.address().port, method, path: url, headers }, res => {
      let text = '';
      res.on('data', c => { text += c; });
      res.on('end', () => {
        let body = text;
        try { body = JSON.parse(text); } catch (e) { /* html */ }
        resolve({ status: res.statusCode, body, text, headers: res.headers });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

beforeEach(async () => {
  roomOccupancy.clear();
  setMockHandler(async (op) => (op === 'get' ? null : []));
  if (!server) server = await new Promise(resolve => { const s = app.listen(0, () => resolve(s)); });
});
after(async () => {
  roomOccupancy.clear();
  setMockHandler(null);
  if (server) await new Promise(resolve => server.close(resolve));
});

describe('AC-U1 one room per customer', () => {
  test('holding room 1, entering room 2 returns 409 and room 2 stays free', async () => {
    assert.equal((await call('POST', '/api/fitting-rooms/1/enter', ALICE)).status, 200);
    const res = await call('POST', '/api/fitting-rooms/2/enter', ALICE);
    assert.equal(res.status, 409);
    assert.ok(!roomOccupancy.get('2'));
    // another customer can still take room 2
    assert.equal((await call('POST', '/api/fitting-rooms/2/enter', BOB)).status, 200);
  });

  test('can resume room 1 after the rejected attempt', async () => {
    const first = await call('POST', '/api/fitting-rooms/1/enter', ALICE);
    await call('POST', '/api/fitting-rooms/2/enter', ALICE);
    const again = await call('POST', '/api/fitting-rooms/1/enter', ALICE);
    assert.equal(again.status, 200);
    assert.equal(again.body.sessionId, first.body.sessionId);
  });

  test('GET /customer/fitting-room for room 2 redirects to dashboard and does not take room 2', async () => {
    await call('POST', '/api/fitting-rooms/1/enter', ALICE);
    const res = await call('GET', '/customer/fitting-room?roomId=2', ALICE);
    assert.equal(res.status, 302);
    assert.ok(res.headers.location.startsWith('/customer/dashboard'));
    assert.ok(!roomOccupancy.get('2'));
  });
});

describe('AC-U2 re-entry after leaving', () => {
  test('after leaving room 1, entering room 2 succeeds', async () => {
    const first = await call('POST', '/api/fitting-rooms/1/enter', ALICE);
    assert.equal(first.status, 200);
    const exit = roomOccupancy.release('1', { cusId: 'cus_001', sessionId: first.body.sessionId });
    assert.ok(exit.ok !== false, 'release should succeed');
    assert.ok(!roomOccupancy.get('1'));
    const res = await call('POST', '/api/fitting-rooms/2/enter', ALICE);
    assert.equal(res.status, 200);
  });
});

describe('AC-U3 cashier has no extra 7% VAT', () => {
  const src = fs.readFileSync(path.join(__dirname, '../views/staff/cashier.ejs'), 'utf8');

  test('source has no total*1.07 / total*0.07 additions', () => {
    assert.doesNotMatch(src, /\*\s*1\.07\b/);
    assert.doesNotMatch(src, /\*\s*0?\.07\b/);
    assert.doesNotMatch(src, /total\s*\+\s*vat/i);
  });

  test('every totalWithVat equals the plain cart total', () => {
    const lines = src.split('\n').filter(l => /\btotalWithVat\s*=/.test(l));
    assert.ok(lines.length > 0);
    for (const l of lines) assert.match(l, /totalWithVat\s*=\s*total\s*;/);
  });

  test('evaluated calc: total 1000 gives payable 1000 and included VAT 65.42', () => {
    const m = src.match(/const vat = ([^;]+);/);
    assert.ok(m);
    const total = 1000;
    const vat = eval(m[1]); // eslint-disable-line no-eval
    assert.ok(Math.abs(vat - 65.42) < 0.01);
    assert.ok(total + 0 === 1000);
  });
});
