const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { resolveRoom } = require('../utils/roomResolver');

const viewPath = path.join(__dirname, '../views/customer/fitting-room.ejs');

describe('views/customer/fitting-room.ejs — room display', () => {
  const source = fs.readFileSync(viewPath, 'utf8');

  test('has no client-side room map or barcode-stripping fallback', () => {
    assert.ok(!source.includes('ROOM_DISPLAY_MAP'));
    assert.ok(!source.includes('568484845232'));
  });

  test('renders resolved display for room 5 and room 10 (not "9" / barcode tail)', () => {
    const ejs = require('ejs');
    for (const n of ['5', '10']) {
      const room = resolveRoom(n);
      const html = ejs.render(
        source,
        { user: {}, roomId: room.barcode, roomDisplay: room.display, sessionId: '', products: [] },
        { filename: viewPath }
      );
      assert.ok(html.includes(`ห้องลองเสื้อ ${n}`), `heading shows room ${n}`);
    }
  });
});
