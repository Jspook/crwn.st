// Cart (mounted under /api)
const express = require('express');
const router = express.Router();
const { getCurrentUser } = require('../../middleware/auth');
const cart = require('../../services/cart');

// GET /api/cart
router.get('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ items: [] });
  }
  try {
    res.json({ items: await cart.getCartItems(user.id) });
  } catch (err) {
    console.error(err);
    res.json({ items: [] });
  }
});

// POST /api/cart
router.post('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ success: true, message: 'Cart not stored for non-customer' });
  }
  try {
    await cart.replaceCart(user.id, req.body.items);
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating cart:', err);
    res.status(err.status || 500).json({ error: err.message || 'Failed to update cart' });
  }
});

// DELETE /api/cart
router.delete('/cart', async (req, res) => {
  const user = getCurrentUser(req);
  if (!user || user.role !== 'CUSTOMER') {
    return res.json({ success: true });
  }
  try {
    await cart.clearCart(user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear cart' });
  }
});

module.exports = router;
