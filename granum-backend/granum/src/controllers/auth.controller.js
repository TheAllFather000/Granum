const bcrypt       = require('bcryptjs');
const { query, transaction } = require('../config/db');
const { requestOTP, verifyOTP: verifyOTPService } = require('../services/otp.service');
const { issueAccessToken, issueRefreshToken, rotateRefreshToken, revokeAllTokens } = require('../services/auth.service');

// normalise SA phone to E.164 (+27...)
function normalisePhone(phone) {
  if (phone.startsWith('+27')) return phone;
  return '+27' + phone.slice(1); // replace leading 0
}

// ── POST /auth/otp/verify ────────────────────────────────────
async function handleVerifyOTP(req, res, next) {
  try {
    const { phone, code, purpose } = req.body;
    await verifyOTPService(phone, purpose, code, false);
    res.json({ verified: true });
  } catch (err) {
    next(err);
  }
}

async function requestOTPHandler(req, res, next) {
  try {
    const phone   = normalisePhone(req.body.phone);
    const purpose = req.body.purpose || 'login';
    const ip      = req.ip;

    // for 'login' purpose: check user exists
    if (purpose === 'login') {
      const { rows } = await query(`SELECT id FROM users WHERE phone = $1`, [phone]);
      if (!rows.length) {
        return res.status(404).json({ error: 'No account found with that phone number. Please register first.' });
      }
    }

    const result = await requestOTP(phone, purpose, ip);
    res.json({
      message:   'OTP sent',
      expiresIn: result.expiresIn,
      // in dev mode, include the OTP in the response so you don't need SMS
      ...(process.env.NODE_ENV === 'development' && { _devNote: 'Check server console for OTP' }),
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/register ────────────────────────────────────────
async function register(req, res, next) {
  try {
    const { phone: rawPhone, otp, role, first_name, last_name, email, password } = req.body;
    const phone = normalisePhone(rawPhone);

    // verify OTP first
    await verifyOTPService(phone, 'register', otp);

    // check phone not already registered
    const existing = await query(`SELECT id FROM users WHERE phone = $1`, [phone]);
    if (existing.rows.length) {
      return res.status(409).json({ error: 'An account with this phone number already exists.' });
    }

    // hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await transaction(async (client) => {
      // create user
      const { rows: [newUser] } = await client.query(
        `INSERT INTO users (phone, email, first_name, last_name, role, status, phone_verified, password_hash)
         VALUES ($1, $2, $3, $4, $5, 'active', true, $6)
         RETURNING id, phone, role, first_name, last_name, status`,
        [phone, email || null, first_name, last_name, role, passwordHash]
      );

      // create empty profile
      await client.query(
        `INSERT INTO profiles (user_id) VALUES ($1)`,
        [newUser.id]
      );

      return newUser;
    });

    const accessToken  = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    res.status(201).json({
      message: 'Account created successfully. Welcome to Granum!',
      user: {
        id:         user.id,
        phone:      user.phone,
        role:       user.role,
        first_name: user.first_name,
        last_name:  user.last_name,
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/login ───────────────────────────────────────────
async function login(req, res, next) {
  try {
    const { phone: rawPhone, otp, password } = req.body;
    const phone = normalisePhone(rawPhone);

    // fetch user
    const { rows } = await query(
      `SELECT id, phone, role, status, first_name, last_name, password_hash, phone_verified
       FROM users WHERE phone = $1`,
      [phone]
    );
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account suspended. Contact support.' });
    if (user.status === 'banned')    return res.status(403).json({ error: 'Account banned.' });
    if (user.status === 'pending_verification') {
      return res.status(403).json({ error: 'Please verify your phone number first.' });
    }

    if (otp) {
      // OTP login
      await verifyOTPService(phone, 'login', otp);
    } else if (password) {
      // password login
      if (!user.password_hash) {
        return res.status(400).json({ error: 'This account uses OTP login. Please request a code.' });
      }
      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else {
      return res.status(400).json({ error: 'Provide either OTP or password.' });
    }

    const accessToken  = issueAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);

    res.json({
      message: `Welcome back, ${user.first_name}!`,
      user: {
        id:         user.id,
        phone:      user.phone,
        role:       user.role,
        first_name: user.first_name,
        last_name:  user.last_name,
      },
      tokens: { accessToken, refreshToken },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/refresh ─────────────────────────────────────────
async function refresh(req, res, next) {
  try {
    const { refresh_token } = req.body;
    const result = await rotateRefreshToken(refresh_token);
    res.json({ tokens: { accessToken: result.accessToken, refreshToken: result.refreshToken } });
  } catch (err) {
    next(err);
  }
}

// ── POST /auth/logout ──────────────────────────────────────────
async function logout(req, res, next) {
  try {
    await revokeAllTokens(req.user.id);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
}

// ── GET /auth/me ───────────────────────────────────────────────
async function me(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT u.id, u.phone, u.email, u.first_name, u.last_name, u.role, u.status,
              u.avatar_url, u.created_at,
              p.business_name, p.tagline, p.province, p.area, p.verified,
              p.rating_sum, p.rating_count
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleVerifyOTP, requestOTPHandler, register, login, refresh, logout, me };
