// Products & barcode lookup (mounted under /api)
const express = require('express');
const router = express.Router();
const catalog = require('../../services/catalog');

// GET /api/products (supports pagination with ?page=1&limit=12)
router.get('/products', async (req, res) => {
  try {
    const { page, limit, category, search } = req.query;
    res.json(await catalog.listProducts({ page, limit, category, search }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// GET /api/products/barcode/:code
router.get('/products/barcode/:code', async (req, res) => {
  const code = req.params.code.trim();
  try {
    const product = await catalog.lookupBarcode(code);
    if (!product) {
      return res.status(404).json({ error: 'ไม่พบสินค้าจากบาร์โค้ดนี้ (ห้ามมั่ว)' });
    }
    res.json(product);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Barcode lookup error' });
  }
});

module.exports = router;
