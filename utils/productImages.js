// ==========================================================
// crwn.st Product Image Resolver
// Each product has public/images/products/<ITM_ID>.webp.
// Products without an image fall back to a category image.
// ==========================================================

const fs = require('fs');
const path = require('path');

const PRODUCT_IMG_DIR = path.join(__dirname, '..', 'public', 'images', 'products');
const PRODUCT_IMG_FILES = new Set(fs.existsSync(PRODUCT_IMG_DIR) ? fs.readdirSync(PRODUCT_IMG_DIR) : []);

function getProductMockImage(tag, productId) {
  const id = String(productId || '').trim().toLowerCase();
  if (id && PRODUCT_IMG_FILES.has(`${id}.webp`)) {
    return `/images/products/${id}.webp`;
  }

  const numMatch = id.match(/\d+/);
  const num = numMatch ? parseInt(numMatch[0], 10) : 1;
  const variantIdx = (num % 2) + 1;

  const normalizedTag = String(tag || '').toLowerCase().trim();
  const validTags = ['top', 'bottom', 'outerwear', 'skirt', 'accessory'];
  const prefix = validTags.includes(normalizedTag) ? normalizedTag : 'top';

  return `/images/products/${prefix}-${variantIdx}.jpg`;
}

module.exports = { getProductMockImage };
