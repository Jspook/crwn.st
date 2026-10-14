// ==========================================================
// crwn.st Canonical Fitting Room Resolver
// Single source of truth for physical fitting room QR & Barcode registry
// ==========================================================

const ROOM_REGISTRY = {
  '5684848452325': { barcode: '5684848452325', roomNumber: '1', display: '1' },
  '5684848452326': { barcode: '5684848452326', roomNumber: '2', display: '2' },
  '5684848452327': { barcode: '5684848452327', roomNumber: '3', display: '3' },
  '5684848452328': { barcode: '5684848452328', roomNumber: '4', display: '4' },
};

const ROOM_ALIASES = {
  '1': '5684848452325',
  '2': '5684848452326',
  '3': '5684848452327',
  '4': '5684848452328',
};

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

  if (ROOM_REGISTRY[s]) {
    return ROOM_REGISTRY[s];
  }

  const aliasBarcode = ROOM_ALIASES[s];
  if (aliasBarcode && ROOM_REGISTRY[aliasBarcode]) {
    return ROOM_REGISTRY[aliasBarcode];
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
