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

// POST /api/auth/register (Customer Registration)
router.post('/register', async (req, res) => {
  const { firstName, lastName, phone, email } = req.body;

  try {
    const cleanPhone = (phone || '').trim().replace(/[-\s]/g, '');
    const cleanFName = (firstName || '').trim();
    const cleanLName = (lastName || '').trim();
    const cleanEmail = (email || '').trim() || `${cleanPhone}@crwn.st`;

    if (!cleanPhone) {
      return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' });
    }
    if (!cleanFName || !cleanLName) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อและนามสกุล' });
    }

    // Check if phone already registered
    const existing = await get(`SELECT CUS_ID FROM CUSTOMER WHERE CUS_Tel = ?`, [cleanPhone]);
    if (existing) {
      return res.status(400).json({ error: 'เบอร์โทรศัพท์นี้ลงทะเบียนสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ' });
    }

    const newId = 'u_' + Date.now().toString().slice(-6);
    await run(
      `INSERT INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId, cleanFName, cleanLName, cleanEmail, cleanPhone, '123456']
    );

    const customer = {
      id: newId,
      name: `${cleanFName} ${cleanLName}`,
      phone: cleanPhone,
      role: 'CUSTOMER'
    };

    // Set auth cookie (7 days)
    res.cookie('crwn_auth', JSON.stringify(customer), {
      httpOnly: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({ success: true, user: customer });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { role, phone, staffCode, username, password, identifier } = req.body;
  const input = String(identifier || phone || staffCode || username || '').trim();

  try {
    if (!input) {
      return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ หรือรหัสพนักงาน' });
    }

    // 1. First, check if input matches an EMPLOYEE (EMP_ID or EMP_Pass / Staff Code)
    const employee = await get(
      `SELECT EMP_ID as id, (EMP_FName || ' ' || EMP_LName) as name, EMP_Role as role, EMP_Pass as staffCode 
       FROM EMPLOYEE 
       WHERE EMP_ID = ? OR EMP_Pass = ? OR EMP_Email = ?`,
      [input, input, input]
    );

    if (employee) {
      const staffUser = {
        id: employee.id,
        name: employee.name,
        role: employee.role, // CASHIER or FITTING_STAFF
        staffCode: employee.staffCode || input,
      };

      res.cookie('crwn_auth', JSON.stringify(staffUser), {
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      const redirectUrl = employee.role === 'CASHIER' ? '/staff/cashier' : '/staff/fitting';
      return res.json({ success: true, user: staffUser, redirectUrl });
    }

    // 2. If not an employee, check if input matches a CUSTOMER (CUS_Tel or CUS_ID)
    const cleanPhone = input.replace(/[-\s]/g, '');
    const customer = await get(
      `SELECT CUS_ID as id, (CUS_FName || ' ' || CUS_LName) as name, CUS_Tel as phone, 'CUSTOMER' as role 
       FROM CUSTOMER 
       WHERE CUS_Tel = ? OR CUS_ID = ?`,
      [cleanPhone, input]
    );

    if (customer) {
      res.cookie('crwn_auth', JSON.stringify(customer), {
        httpOnly: false,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/'
      });

      return res.json({ success: true, user: customer, redirectUrl: '/customer/dashboard' });
    }

    // 3. Neither found: return clear guidance
    return res.status(404).json({
      error: 'ไม่พบเบอร์โทรศัพท์หรือรหัสพนักงานนี้ในระบบ (หากเป็นลูกค้า กรุณากดสมัครสมาชิกใหม่)',
      notFound: true,
      phone: cleanPhone
    });
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
