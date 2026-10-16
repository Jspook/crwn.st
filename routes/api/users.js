// Member search for POS (mounted under /api)
const express = require('express');
const router = express.Router();
const { query } = require('../../database/db');
const { requireRole } = require('../../middleware/auth');

// GET /api/users?phone=08xxxxxxxx — cashier-only exact phone lookup (no bulk PII dump)
router.get('/users', requireRole('CASHIER'), async (req, res) => {
  const phone = String(req.query.phone || '').replace(/[-\s]/g, '');
  if (!/^\d{9,10}$/.test(phone)) {
    return res.json([]);
  }
  try {
    const customers = await query(
      `SELECT CUS_ID as id, CONCAT(CUS_FName, ' ', CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
       FROM CUSTOMER WHERE CUS_Tel = ? LIMIT 1`,
      [phone]
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
