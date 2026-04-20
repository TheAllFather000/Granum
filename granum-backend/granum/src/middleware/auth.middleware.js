const { verifyAccessToken } = require('../services/auth.service');
const { query }             = require('../config/db');

/**
 * authenticate — verifies the Bearer token and attaches req.user
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);

    // lightweight DB check — confirm user is still active
    const { rows } = await query(
      `SELECT id, phone, role, status, first_name, last_name
       FROM users WHERE id = $1`,
      [payload.sub]
    );
    const user = rows[0];

    if (!user)             return res.status(401).json({ error: 'User not found' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended' });
    if (user.status === 'banned')    return res.status(403).json({ error: 'Account banned' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }
}

/**
 * requireRole(...roles) — role-based access control
 * Use after authenticate.
 * e.g. requireRole('admin'), requireRole('farmer','manufacturer')
 */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}

/**
 * optionalAuth — attaches req.user if token present, but doesn't block.
 * Useful for public routes that behave differently when logged in.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return next();

  const token = header.slice(7);
  try {
    const payload = verifyAccessToken(token);
    const { rows } = await query(
      `SELECT id, phone, role, status FROM users WHERE id = $1`,
      [payload.sub]
    );
    if (rows[0] && rows[0].status === 'active') req.user = rows[0];
  } catch (_) {
    // silently ignore bad tokens on optional routes
  }
  next();
}

module.exports = { authenticate, requireRole, optionalAuth };
