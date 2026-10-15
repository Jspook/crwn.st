// ==========================================================
// crwn.st Canonical Fitting Room Resolver
// Single source of truth for physical fitting room QR & Barcode registry
// ==========================================================

// Room N barcode = QR_BASE + N (room 1 = 5684848452325 ... room 10 = 5684848452334).
// Rooms 2-10 follow the approved rule and must be verified against physical stickers.
const QR_BASE = 5684848452324;
const ROOM_COUNT = 10;

const ROOM_REGISTRY = {};
const ROOM_ALIASES = {};
for (let n = 1; n <= ROOM_COUNT; n += 1) {
  const barcode = String(QR_BASE + n);
  const roomNumber = String(n);
  ROOM_REGISTRY[barcode] = { barcode, roomNumber, display: roomNumber };
  ROOM_ALIASES[roomNumber] = barcode;
}

const ROOM_BARCODES = Object.keys(ROOM_REGISTRY);

/**
 * Resolve a raw room ID or QR barcode into a canonical room object.
 * Returns null if the room ID is invalid or unrecognized.
 * 
 * @param {string|number} rawId 
 * @returns {{ barcode: string, roomNumber: string, display: string } | null}
 */
function resolveRoom(rawId) {
  if (rawId === undefined || rawId === null) return null;
  const s = String(rawId).trim();
  if (!s) return null;

  // 1. Direct registry check (exact canonical 13-digit barcode)
  if (ROOM_REGISTRY[s]) {
    return ROOM_REGISTRY[s];
  }

  // 2. Direct alias check (e.g. '1' - '10')
  const aliasBarcode = ROOM_ALIASES[s];
  if (aliasBarcode && ROOM_REGISTRY[aliasBarcode]) {
    return ROOM_REGISTRY[aliasBarcode];
  }

  // 3. Extract the room parameter from a URL, query string, or deep link (e.g. '?roomId=...',
  //    '.../fitting-room?roomId=1', '.../fitting-room/4').
  //    P1.5 fixes (card t_5d19c63b): the room key is matched case-insensitively, the value never
  //    absorbs a '#fragment', and a relative deep-link path is accepted like its absolute form.
  //    A leading '#' is preserved: '#7' is a colloquial room token, not a fragment on an empty base.
  const hashIndex = s.indexOf('#');
  const queryless = hashIndex > 0 ? s.slice(0, hashIndex) : s;

  let candidate = queryless;
  if (/(?:roomid|room)=/i.test(queryless)) {
    const m = queryless.match(/(?:roomid|room)=([^&#]*)/i);
    if (m) {
      candidate = decodeURIComponent(m[1]).trim();
    }
  } else if (queryless.startsWith('http://') || queryless.startsWith('https://')) {
    const lastPart = queryless.split('/').pop().split('?')[0].trim();
    if (lastPart) candidate = lastPart;
  } else if (queryless.startsWith('/') && queryless.includes('/fitting-room')) {
    const lastPart = queryless.split('?')[0].split('/').filter(Boolean).pop();
    if (lastPart && lastPart !== 'fitting-room') candidate = lastPart;
  }

  if (ROOM_REGISTRY[candidate]) {
    return ROOM_REGISTRY[candidate];
  }
  if (ROOM_ALIASES[candidate] && ROOM_REGISTRY[ROOM_ALIASES[candidate]]) {
    return ROOM_REGISTRY[ROOM_ALIASES[candidate]];
  }

  // 4. Barcode with spaces, hyphens, or underscores (e.g. '5684-8484-52325')
  const digitsOnly = candidate.replace(/[\s\-_]/g, '');
  if (digitsOnly.length === 13 && ROOM_REGISTRY[digitsOnly]) {
    return ROOM_REGISTRY[digitsOnly];
  }

  // 5. Thai and English colloquial prefixes (e.g. 'ห้อง 1', 'ห้อง1', 'ห้องที่ 1', 'Room 1', 'room-1', 'r1', '01')
  const colloquialMatch = candidate.match(/^(?:ห้อง(?:ที่|ลอง)?|room|r|#)?[\s\-_]*(\d{1,2})$/i);
  if (colloquialMatch) {
    const cleanNum = String(parseInt(colloquialMatch[1], 10));
    if (ROOM_ALIASES[cleanNum] && ROOM_REGISTRY[ROOM_ALIASES[cleanNum]]) {
      return ROOM_REGISTRY[ROOM_ALIASES[cleanNum]];
    }
  }

  return null;
}

/**
 * Check if a raw room ID or barcode is valid.
 * @param {string|number} rawId 
 * @returns {boolean}
 */
function isValidRoom(rawId) {
  return resolveRoom(rawId) !== null;
}

/**
 * Get canonical barcode for a raw room ID.
 * Returns null if invalid.
 * @param {string|number} rawId 
 * @returns {string|null}
 */
function getCanonicalBarcode(rawId) {
  const resolved = resolveRoom(rawId);
  return resolved ? resolved.barcode : null;
}

/**
 * Get display number for a raw room ID.
 * Returns null if invalid.
 * @param {string|number} rawId 
 * @returns {string|null}
 */
function getRoomDisplayNumber(rawId) {
  const resolved = resolveRoom(rawId);
  return resolved ? resolved.display : null;
}

/**
 * Get all registered rooms
 * @returns {Array<{ barcode: string, roomNumber: string, display: string }>}
 */
function getAllRooms() {
  return Object.values(ROOM_REGISTRY);
}

module.exports = {
  ROOM_REGISTRY,
  ROOM_ALIASES,
  ROOM_BARCODES,
  resolveRoom,
  isValidRoom,
  getCanonicalBarcode,
  getRoomDisplayNumber,
  getAllRooms,
};
