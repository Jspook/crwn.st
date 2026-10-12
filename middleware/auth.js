// ==========================================================
// crwn.st Centralized Auth Helpers & Middleware
// Identity is read ONLY from a signed, httpOnly cookie.
// ==========================================================

const AUTH_COOKIE = 'crwn_auth';
const VALID_ROLES = Object.freeze(['CUSTOMER', 'CASHIER', 'FITTING_STAFF']);
const AUTH_MAX_AGE_MS = 8 * 60 * 60 * 1000; // 8 hours

function cookieOptions() {
  return {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: AUTH_MAX_AGE_MS,
    path: '/'
  };
}

/**
 * Issue the auth cookie. Only non-sensitive identity fields are stored.
 */
function setAuthCookie(res, user) {
  const payload = {
    id: String(user.id),
    name: String(user.name || ''),
    role: user.role
  };
  if (user.phone) payload.phone = String(user.phone);
  res.cookie(AUTH_COOKIE, JSON.stringify(payload), cookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
}

/**
 * Returns the authenticated user or null.
 * Unsigned / tampered cookies are rejected by cookie-parser (value === false).
 */
function getCurrentUser(req) {
  const raw = req.signedCookies && req.signedCookies[AUTH_COOKIE];
  if (!raw || typeof raw !== 'string') return null;
  try {
    const user = JSON.parse(raw);
    if (!user || typeof user.id !== 'string' || !user.id) return null;
    if (!VALID_ROLES.includes(user.role)) return null;
    return user;
  } catch (e) {
    return null;
  }
}

/** API guard: any authenticated user */
function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
}

/** API guard: specific roles */
function requireRole(...roles) {
  return (req, res, next) => {
    const user = getCurrentUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  };
}

module.exports = {
  AUTH_COOKIE,
  VALID_ROLES,
  setAuthCookie,
  clearAuthCookie,
  getCurrentUser,
  requireAuth,
  requireRole
};
