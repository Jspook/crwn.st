const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveRoom,
  isValidRoom,
  getCanonicalBarcode,
  getRoomDisplayNumber,
  getAllRooms,
  ROOM_BARCODES,
} = require('../utils/roomResolver');

describe('utils/roomResolver — Canonical Fitting Room Registry', () => {
  test('resolves known 13-digit barcodes to correct room metadata', () => {
    const r1 = resolveRoom('5684848452325');
    assert.deepEqual(r1, { barcode: '5684848452325', roomNumber: '1', display: '1' });

    const r2 = resolveRoom('5684848452326');
    assert.deepEqual(r2, { barcode: '5684848452326', roomNumber: '2', display: '2' });

    const r3 = resolveRoom('5684848452327');
    assert.deepEqual(r3, { barcode: '5684848452327', roomNumber: '3', display: '3' });

    const r4 = resolveRoom('5684848452328');
    assert.deepEqual(r4, { barcode: '5684848452328', roomNumber: '4', display: '4' });
  });

  test('resolves short room aliases (1-4) to canonical barcode and display', () => {
    assert.equal(getCanonicalBarcode('1'), '5684848452325');
    assert.equal(getRoomDisplayNumber('1'), '1');

    assert.equal(getCanonicalBarcode('2'), '5684848452326');
    assert.equal(getRoomDisplayNumber('2'), '2');

    assert.equal(getCanonicalBarcode('3'), '5684848452327');
    assert.equal(getRoomDisplayNumber('3'), '3');

    assert.equal(getCanonicalBarcode('4'), '5684848452328');
    assert.equal(getRoomDisplayNumber('4'), '4');
  });

  test('rejects unknown, malformed, or phantom QR codes (e.g. 53636636373363)', () => {
    assert.equal(resolveRoom('53636636373363'), null);
    assert.equal(isValidRoom('53636636373363'), false);
    assert.equal(getCanonicalBarcode('53636636373363'), null);
    assert.equal(getRoomDisplayNumber('53636636373363'), null);

    assert.equal(resolveRoom('0'), null);
    assert.equal(resolveRoom('11'), null);
    assert.equal(resolveRoom('5684848452335'), null);
    assert.equal(resolveRoom('5684848452324'), null);
    assert.equal(resolveRoom(''), null);
    assert.equal(resolveRoom('   '), null);
    assert.equal(resolveRoom(null), null);
    assert.equal(resolveRoom(undefined), null);
    assert.equal(resolveRoom('unknown-room'), null);
  });

  test('rooms 5-10 resolve by barcode (base 5684848452324 + N) and by alias', () => {
    for (let n = 5; n <= 10; n += 1) {
      const barcode = String(5684848452324 + n);
      const expected = { barcode, roomNumber: String(n), display: String(n) };
      assert.deepEqual(resolveRoom(barcode), expected);
      assert.deepEqual(resolveRoom(String(n)), expected);
      assert.equal(getCanonicalBarcode(String(n)), barcode);
      assert.equal(getRoomDisplayNumber(barcode), String(n));
    }
    assert.equal(getRoomDisplayNumber('10'), '10');
  });

  test('getAllRooms returns all 10 physical rooms in order', () => {
    const all = getAllRooms();
    assert.equal(all.length, 10);
    assert.deepEqual(all.map(r => r.roomNumber), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    assert.deepEqual(
      ROOM_BARCODES,
      Array.from({ length: 10 }, (_, i) => String(5684848452325 + i))
    );
  });

  test('normalizes colloquial inputs: Thai names, URLs, leading zeros, and formatted barcodes', () => {
    assert.deepEqual(resolveRoom('ห้อง 1'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
    assert.deepEqual(resolveRoom('ห้อง1'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
    assert.deepEqual(resolveRoom('ห้องที่ 2'), { barcode: '5684848452326', roomNumber: '2', display: '2' });
    assert.deepEqual(resolveRoom('ห้องลอง 3'), { barcode: '5684848452327', roomNumber: '3', display: '3' });
    assert.deepEqual(resolveRoom('Room 4'), { barcode: '5684848452328', roomNumber: '4', display: '4' });
    assert.deepEqual(resolveRoom('room-5'), { barcode: '5684848452329', roomNumber: '5', display: '5' });
    assert.deepEqual(resolveRoom('06'), { barcode: '5684848452330', roomNumber: '6', display: '6' });
    assert.deepEqual(resolveRoom('#7'), { barcode: '5684848452331', roomNumber: '7', display: '7' });
    assert.deepEqual(resolveRoom('5684-8484-52325'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
    assert.deepEqual(resolveRoom('5684 8484 52325'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
    assert.deepEqual(resolveRoom('http://localhost:3000/customer/fitting-room?roomId=1'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
    assert.deepEqual(resolveRoom('https://crwn.st/customer/fitting-room?roomId=5684848452325'), { barcode: '5684848452325', roomNumber: '1', display: '1' });
  });
});
