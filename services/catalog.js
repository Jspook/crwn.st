// ==========================================================
// Catalog service: ITEM / ITEM_VARIANT queries and JSON mapping
// ==========================================================

const { query, get } = require('../database/db');
const { getProductMockImage } = require('../utils/productImages');

function toVariantJson(v, { withLocation = false } = {}) {
  const out = {
    sku: v.ITV_SKUID,
    color: v.ITV_Color,
    size: v.ITV_Size,
    stock: v.ITV_Stock
  };
  if (withLocation) out.locationId = v.LOC_ID;
  return out;
}

function groupVariantsByItem(variants, opts) {
  const map = {};
  for (const v of variants) {
    if (!map[v.ITM_ID]) map[v.ITM_ID] = [];
    map[v.ITM_ID].push(toVariantJson(v, opts));
  }
  return map;
}

function toProductJson(item, variantMap) {
  return {
    id: item.ITM_ID,
    ITM_ID: item.ITM_ID,
    name: item.ITM_Name,
    ITM_Name: item.ITM_Name,
    description: item.ITM_Description,
    price: item.ITM_Price,
    ITM_Price: item.ITM_Price,
    category: item.ITM_Category,
    ITM_Category: item.ITM_Category,
    tag: item.ITM_Tag,
    image: getProductMockImage(item.ITM_Tag, item.ITM_ID),
    variants: variantMap[item.ITM_ID] || []
  };
}

// Supports pagination: a numeric page > 0 returns { data, pagination }, otherwise an array.
async function listProducts({ category, search, page, limit } = {}) {
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit) || 12;
  const cleanSearch = search ? String(search).trim() : null;

  let itemsQuery = `SELECT * FROM ITEM`;
  let countQuery = `SELECT COUNT(*) as total FROM ITEM`;
  const params = [];
  const countParams = [];

  const conditions = [];
  if (category && category !== 'ALL') {
    conditions.push(`ITM_Category = ?`);
    params.push(category);
    countParams.push(category);
  }
  if (cleanSearch) {
    conditions.push(`(ITM_Name LIKE ? OR ITM_Tag LIKE ?)`);
    params.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
    countParams.push(`%${cleanSearch}%`, `%${cleanSearch}%`);
  }

  if (conditions.length > 0) {
    const whereClause = ` WHERE ` + conditions.join(' AND ');
    itemsQuery += whereClause;
    countQuery += whereClause;
  }

  itemsQuery += ` ORDER BY ITM_ID ASC`;

  if (!isNaN(pageNum) && pageNum > 0) {
    const totalResult = await get(countQuery, countParams);
    const total = totalResult ? totalResult.total : 0;
    const offset = (pageNum - 1) * limitNum;
    itemsQuery += ` LIMIT ? OFFSET ?`;
    params.push(limitNum, offset);

    const items = await query(itemsQuery, params);
    const variants = await query(`SELECT * FROM ITEM_VARIANT`);
    const variantMap = groupVariantsByItem(variants, { withLocation: true });

    return {
      data: items.map(item => toProductJson(item, variantMap)),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    };
  }

  const items = await query(itemsQuery, params);
  const variants = await query(`SELECT * FROM ITEM_VARIANT`);
  const variantMap = groupVariantsByItem(variants, { withLocation: true });
  return items.map(item => toProductJson(item, variantMap));
}

// Returns the barcode lookup payload, or null when nothing matches.
async function lookupBarcode(code) {
  // 1. Try finding matching variant by SKU
  const variant = await get(
    `SELECT v.*, i.ITM_Name, i.ITM_Price, i.ITM_Category, i.ITM_Description, i.ITM_Tag
       FROM ITEM_VARIANT v
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID
       WHERE v.ITV_SKUID = ?`,
    [code]
  );

  // 2. If not found, try finding by ITM_ID
  if (!variant) {
    const item = await get(`SELECT * FROM ITEM WHERE ITM_ID = ?`, [code]);
    if (!item) return null;
    const itemVariants = await query(`SELECT * FROM ITEM_VARIANT WHERE ITM_ID = ?`, [code]);
    return {
      id: item.ITM_ID,
      name: item.ITM_Name,
      price: item.ITM_Price,
      category: item.ITM_Category,
      tag: item.ITM_Tag,
      image: getProductMockImage(item.ITM_Tag, item.ITM_ID),
      variants: itemVariants.map(iv => toVariantJson(iv))
    };
  }

  return {
    id: variant.ITM_ID,
    name: variant.ITM_Name,
    price: variant.ITM_Price,
    category: variant.ITM_Category,
    tag: variant.ITM_Tag,
    image: getProductMockImage(variant.ITM_Tag, variant.ITM_ID),
    variants: [toVariantJson(variant)]
  };
}

async function listItemsWithImages() {
  const products = await query(`SELECT * FROM ITEM ORDER BY ITM_ID ASC`);
  products.forEach(p => {
    p.image = getProductMockImage(p.ITM_Tag, p.ITM_ID);
  });
  return products;
}

async function listItemsWithVariants() {
  const products = await listItemsWithImages();
  const variants = await query(`SELECT * FROM ITEM_VARIANT`);
  const map = groupVariantsByItem(variants);
  products.forEach(p => {
    p.variants = map[p.ITM_ID] || [];
  });
  return products;
}

function getVariantWithItem(sku) {
  return get(
    `SELECT v.ITV_SKUID, v.ITV_Stock, v.ITV_Color, v.ITV_Size, i.ITM_Name, i.ITM_Price, i.ITM_Tag, i.ITM_ID 
       FROM ITEM_VARIANT v 
       JOIN ITEM i ON v.ITM_ID = i.ITM_ID 
       WHERE v.ITV_SKUID = ?`,
    [sku]
  );
}

module.exports = {
  toVariantJson,
  groupVariantsByItem,
  toProductJson,
  listProducts,
  lookupBarcode,
  listItemsWithImages,
  listItemsWithVariants,
  getVariantWithItem
};
