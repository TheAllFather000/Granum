const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../config/db');

const SECRET          = process.env.JWT_SECRET || 'dev_secret_change_me';
const EXPIRES_IN      = process.env.JWT_EXPIRES_IN       || '7d';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

/**
 * Issue an access token (short-lived JWT).
 */
function issueAccessToken(user) {
  return jwt.sign(
    {
      sub:   user.id,
      phone: user.phone,
      role:  user.role,
    },
    SECRET,
    { expiresIn: EXPIRES_IN }
  );
}

/**
 * Issue a refresh token and persist it in the DB.
 * Returns the raw token string.
 */
async function issueRefreshToken(userId) {
  const raw  = crypto.randomBytes(64).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  // store hashed version — never store raw tokens in DB
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, hash, expiresAt]
  );

  return raw;
}

/**
 * Rotate a refresh token.
 * Validates the old one, revokes it, issues a new pair.
 */
async function rotateRefreshToken(rawToken) {
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const { rows } = await query(
    `SELECT rt.*, u.role, u.phone, u.status
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1`,
    [hash]
  );

  const record = rows[0];
  if (!record || record.revoked || new Date(record.expires_at) < new Date()) {
    throw Object.assign(new Error('Invalid or expired refresh token'), { status: 401 });
  }
  if (record.status !== 'active') {
    throw Object.assign(new Error('Account is not active'), { status: 403 });
  }

  // revoke old token
  await query(`UPDATE refresh_tokens SET revoked = true WHERE id = $1`, [record.id]);

  // issue new pair
  const user = { id: record.user_id, phone: record.phone, role: record.role };
  const accessToken  = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(record.user_id);

  return { accessToken, refreshToken, user };
}

/**
 * Revoke all refresh tokens for a user (logout everywhere).
 */
async function revokeAllTokens(userId) {
  await query(
    `UPDATE refresh_tokens SET revoked = true WHERE user_id = $1 AND revoked = false`,
    [userId]
  );
}

/**
 * Verify an access token. Returns the decoded payload or throws.
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, SECRET);
  } catch (err) {
    throw Object.assign(new Error('Invalid or expired token'), { status: 401 });
  }
}

module.exports = {
  issueAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeAllTokens,
  verifyAccessToken,
};
