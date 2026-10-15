// Sale orders & receipts (mounted under /api)
const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../../middleware/auth');
const receipts = require('../../services/receipts');

// GET /api/receipts
router.get('/receipts', requireRole('CASHIER'), async (req, res) => {
  try {
    res.json(await receipts.listReceipts());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch receipts' });
  }
});

// GET /api/receipts/:id — owner (customer) or cashier only
router.get('/receipts/:id', requireAuth, async (req, res) => {
  try {
    const order = await receipts.getReceiptWithLines(req.params.id);
    if (!receipts.canViewReceipt(order, req.user)) {
      // 404 for both cases to avoid receipt ID enumeration
      return res.status(404).json({ error: 'Receipt not found' });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Receipt lookup error' });
  }
});

// POST /api/receipts
router.post('/receipts', requireRole('CUSTOMER', 'CASHIER'), async (req, res) => {
  const { paymentMethod, items, memberId } = req.body;
  const user = req.user;
  const isCashier = user.role === 'CASHIER';
  // Customers can only buy for themselves; cashiers may attach a member
  const cusId = isCashier ? (memberId ? String(memberId) : null) : user.id;
  const empId = isCashier ? user.id : null;
  const channel = isCashier ? 'pos_cashier' : 'customer_pay_and_go';
  const ALLOWED_METHODS = ['cash', 'credit', 'qr'];
  if (paymentMethod && !ALLOWED_METHODS.includes(paymentMethod)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_METHOD', message: 'Invalid payment method' } });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_CART',
        message: 'ไม่มีรายการสินค้าในคำสั่งซื้อ กรุณาเลือกสินค้าก่อนชำระเงิน'
      }
    });
  }

  try {
    const result = await receipts.createSale({ items, paymentMethod, cusId, empId, channel });
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Order transaction error:', err);
    if (err.code === 'OUT_OF_STOCK') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OUT_OF_STOCK',
          message: err.message,
          details: err.details || null
        }
      });
    }
    if (err.code === 'PRODUCT_NOT_FOUND' || err.code === 'INVALID_SKU') {
      return res.status(400).json({
        success: false,
        error: {
          code: err.code,
          message: err.message
        }
      });
    }
    return res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTION_FAILED',
        message: 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ กรุณาลองใหม่อีกครั้ง'
      }
    });
  }
});

module.exports = router;
