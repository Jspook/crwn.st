// ==========================================================
// crwn.st Authentication Routes (REST API) — MySQL
// ==========================================================

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { get, run } = require('../database/db');
const { getCurrentUser, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { newShortId } = require('../utils/ids');

// POST /api/auth/register (Customer Registration)
router.post('/register', async (req, res) => {
  const { firstName, lastName, phone, email, password } = req.body;

  try {
    const cleanPhone = (phone || '').trim().replace(/[-\s]/g, '');
    const cleanFName = (firstName || '').trim();
    const cleanLName = (lastName || '').trim();
    const cleanEmail = (email || '').trim() || `${cleanPhone}@crwn.st`;
    const cleanPass = String(password || '').trim();

    if (!cleanPhone) {
      return res.status(400).json({ error: 'กรุณาระบุเบอร์โทรศัพท์' });
    }
    if (!cleanFName || !cleanLName) {
      return res.status(400).json({ error: 'กรุณาระบุชื่อและนามสกุล' });
    }
    if (!cleanPass || cleanPass.length < 4) {
      return res.status(400).json({ error: 'กรุณากำหนดรหัสผ่านอย่างน้อย 4 ตัวอักษร' });
    }

    // Check if phone already registered
    const existing = await get(`SELECT CUS_ID FROM CUSTOMER WHERE CUS_Tel = ?`, [cleanPhone]);
    if (existing) {
      return res.status(400).json({ error: 'เบอร์โทรศัพท์นี้ลงทะเบียนสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ', alreadyRegistered: true });
    }

    const newId = newShortId('u_');
    const hashedPassword = bcrypt.hashSync(cleanPass, 10);
    await run(
      `INSERT INTO CUSTOMER (CUS_ID, CUS_FName, CUS_LName, CUS_Email, CUS_Tel, CUS_Pass) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [newId, cleanFName, cleanLName, cleanEmail, cleanPhone, hashedPassword]
    );

    const customer = {
      id: newId,
      name: `${cleanFName} ${cleanLName}`,
      phone: cleanPhone,
      role: 'CUSTOMER'
    };

    setAuthCookie(res, customer);

    return res.json({ success: true, user: customer });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'เกิดข้อผิดพลาดในการสมัครสมาชิก' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { phone, staffCode, username, password, identifier } = req.body;
  const input = String(identifier || phone || staffCode || username || '').trim();
  const inputPass = String(password || '').trim();

  try {
    if (!input) {
      return res.status(400).json({ error: 'กรุณากรอกเบอร์โทรศัพท์ หรือรหัสพนักงาน' });
    }
    if (!inputPass) {
      return res.status(400).json({ error: 'กรุณากรอกรหัสผ่าน' });
    }

    // 1. First, check if input matches an EMPLOYEE (EMP_ID or email only — never look up by password)
    const employee = await get(
      `SELECT EMP_ID as id, CONCAT(EMP_FName, ' ', EMP_LName) as name, EMP_Role as role, EMP_Pass as staffCode 
       FROM EMPLOYEE 
       WHERE EMP_ID = ? OR EMP_Email = ?`,
      [input, input]
    );

    if (employee) {
      // Validate employee password (supports bcrypt hash or legacy match)
      let isEmpMatch = false;
      const storedPass = String(employee.staffCode || '');
      if (storedPass.startsWith('$2a$') || storedPass.startsWith('$2b$')) {
        isEmpMatch = bcrypt.compareSync(inputPass, storedPass);
      } else {
        isEmpMatch = storedPass.length > 0 && storedPass === inputPass;
        if (isEmpMatch) {
          // Auto upgrade legacy plain password to bcrypt hash
          const newHash = bcrypt.hashSync(inputPass, 10);
          await run(`UPDATE EMPLOYEE SET EMP_Pass = ? WHERE EMP_ID = ?`, [newHash, employee.id]).catch(() => {});
        }
      }

      if (!isEmpMatch) {
        return res.status(401).json({ error: 'รหัสผ่านพนักงานไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง' });
      }

      const staffUser = {
        id: employee.id,
        name: employee.name,
        role: employee.role // CASHIER or FITTING_STAFF
      };

      setAuthCookie(res, staffUser);

      const redirectUrl = employee.role === 'CASHIER' ? '/staff/cashier' : '/staff/fitting';
      return res.json({ success: true, user: staffUser, redirectUrl });
    }

    // 2. If not an employee, check if input matches a CUSTOMER (CUS_Tel or CUS_ID)
    const cleanPhone = input.replace(/[-\s]/g, '');
    const customer = await get(
      `SELECT CUS_ID as id, CONCAT(CUS_FName, ' ', CUS_LName) as name, CUS_Tel as phone, CUS_Pass as password, 'CUSTOMER' as role 
       FROM CUSTOMER 
       WHERE CUS_Tel = ? OR CUS_ID = ?`,
      [cleanPhone, input]
    );

    if (customer) {
      // Validate customer password (supports bcrypt hash or legacy match)
      let isCusMatch = false;
      const storedCusPass = String(customer.password || '');
      if (storedCusPass.startsWith('$2a$') || storedCusPass.startsWith('$2b$')) {
        isCusMatch = bcrypt.compareSync(inputPass, storedCusPass);
      } else {
        isCusMatch = (storedCusPass === inputPass);
        if (isCusMatch) {
          // Auto upgrade legacy plain password to bcrypt hash
          const newHash = bcrypt.hashSync(inputPass, 10);
          await run(`UPDATE CUSTOMER SET CUS_Pass = ? WHERE CUS_ID = ?`, [newHash, customer.id]).catch(() => {});
        }
      }

      if (!isCusMatch) {
        return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบและลองใหม่อีกครั้ง' });
      }

      // Preserve customer's existing cart items across login sessions

      const customerUser = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone,
        role: 'CUSTOMER'
      };

      setAuthCookie(res, customerUser);

      return res.json({ success: true, user: customerUser, redirectUrl: '/customer/dashboard' });
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
// Logout must NOT clear PAY_CART_ITEM: unpaid cart persists until checkout or explicit clear
router.post('/logout', async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ user });
});

module.exports = router;
