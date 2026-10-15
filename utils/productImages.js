// ==========================================================
// crwn.st Product Image Resolver
// Each product has public/images/products/<ITM_ID>.webp.
// A product without its own image shows the default image p1.webp.
// ==========================================================

const fs = require('fs');
const path = require('path');

const PRODUCT_IMG_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
const PRODUCT_IMG_FILES = new Set(fs.existsSync(PRODUCT_IMG_DIR) ? fs.readdirSync(PRODUCT_IMG_DIR) : []);
const DEFAULT_IMAGE = '/images/products/p1.webp';

function getProductMockImage(tag, productId) {
  const id = String(productId || '').trim().toLowerCase();
  if (id && PRODUCT_IMG_FILES.has(`${id}.webp`)) {
    return `/images/products/${id}.webp`;
  }
  return DEFAULT_IMAGE;
}

module.exports = { getProductMockImage };
