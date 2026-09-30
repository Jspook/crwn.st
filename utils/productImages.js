// ==========================================================
// crwn.st Product Mock Image Resolver
// Maps product categories/tags into clean, aesthetic local mock images
// ==========================================================

function getProductMockImage(tag, id) {
  const num = id ? (parseInt(String(id).replace(/[^0-9]/g, ''), 10) || 1) : 1;
  const variantIndex = (num % 2) + 1; // Alternates between 1 and 2
  const cleanTag = String(tag || '').toLowerCase().trim();

  if (cleanTag === 'outerwear') {
    return `/images/products/outerwear-${variantIndex}.jpg`;
  }
  if (cleanTag === 'bottom') {
    return `/images/products/bottom-${variantIndex}.jpg`;
  }
  if (cleanTag === 'skirt') {
    return `/images/products/skirt-${variantIndex}.jpg`;
  }
  if (cleanTag === 'accessory') {
    return `/images/products/accessory-${variantIndex}.jpg`;
  }
  // Default to top
  return `/images/products/top-${variantIndex}.jpg`;
}

module.exports = {
  getProductMockImage
};
