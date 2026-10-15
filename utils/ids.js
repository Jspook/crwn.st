const crypto = require('crypto');

function newShortId(prefix) {
  return prefix + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');
}

module.exports = { newShortId };
