// ==========================================================
// crwn.st Authentication Routes (REST API)
// ==========================================================

const express = require('express');
const router = express.Router();
const { query, get, run } = require('../database/db');

// Helper to get current user from cookies
function getCurrentUser(req) {
  try {
    if (req.cookies && req.cookies.crwn_auth) {
      return JSON.parse(req.cookies.crwn_auth);
    }
  } catch (e) {
    // Ignore parse error
  }
  return null;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { role, phone, username, password } = req.body;

  try {
    if (role === 'CUSTOMER') {
      if (!phone) {
        return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' });
      }

      // Query CUSTOMER table
      let customer = await get(
        `SELECT CUS_ID as id, (CUS_FName || ' ' || CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
         FROM CUSTOMER WHERE CUS_Tel = ?`,
        [phone]
      );

      // If customer doesn't exist yet, auto-register
      if (!customer) {
        const newId = 'u_' + Date.now().toString().slice(-6);
        await run(
          `INSERT INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [newId, 'Customer', phone.slice(-4), `${newId}@crwn.st`, phone, '123456']
        );
        customer = {
          id: newId,
          name: `Customer ${phone.slice(-4)}`,
          phone,
          role: 'CUSTOMER'
        };
      }

      // Set cookie (valid for 7 days)
      res.cookie('crwn_auth', JSON.stringify(customer), {
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.json({ success: true, user: customer });
    }

    // Staff Login
    if (role === 'STAFF') {
      if (!username || !password) {
        return res.status(400).json({ error: 'กรุณาระบุชื่อผู้ใช้และรหัสผ่าน' });
      }

      const employee = await get(
        `SELECT EMP_ID as id, (EMP_FName || ' ' || EMP_LName) as name, EMP_Role as role, EMP_Pass as password 
         FROM EMPLOYEE 
         WHERE EMP_ID = ? OR EMP_Email LIKE ?`,
        [username, `%${username}%`]
      );

      if (!employee || employee.password !== password) {
        return res.status(401).json({ error: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      }

      const staffUser = {
        id: employee.id,
        name: employee.name,
        role: employee.role, // CASHIER or FITTING_STAFF
      };

      res.cookie('crwn_auth', JSON.stringify(staffUser), {
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.json({ success: true, user: staffUser });
    }

    return res.status(400).json({ error: 'Invalid role' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('crwn_auth', { path: '/' });
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user });
});

module.exports = router;
module.exports.getCurrentUser = getCurrentUser;
