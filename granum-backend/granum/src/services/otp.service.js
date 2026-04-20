const crypto = require('crypto');
const redis  = require('../config/redis');
const { sendOTP } = require('./sms.service');
const { query }   = require('../config/db');

const OTP_TTL    = parseInt(process.env.OTP_TTL_SECONDS || '300'); // 5 min
const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6');
const MAX_ATTEMPTS = 10; // Allow up to 10 attempts per OTP

function generateOTP() {
  // cryptographically random numeric OTP
  const bytes = crypto.randomBytes(4);
  const num   = bytes.readUInt32BE(0) % Math.pow(10, OTP_LENGTH);
  return String(num).padStart(OTP_LENGTH, '0');
}

function otpKey(phone, purpose) {
  return `otp:${purpose}:${phone}`;
}

function attemptsKey(phone, purpose) {
  return `otp_attempts:${purpose}:${phone}`;
}

/**
 * Generate and send an OTP to the given phone number.
 * Returns { sent: true } on success.
 */
async function requestOTP(phone, purpose, ipAddress = null) {
  // rate-limit: max 5 OTPs per 10 minutes per phone+purpose
  const rateLimitKey = `otp_rate:${purpose}:${phone}`;
  const sends = await redis.incr(rateLimitKey);
  if (sends === 1) await redis.expire(rateLimitKey, 600);
  if (sends > 5) {
    throw Object.assign(new Error('Too many OTP requests. Please wait 10 minutes.'), { status: 429 });
  }

  const otp = generateOTP();

  // store hashed OTP in Redis with TTL
  const hash = crypto.createHash('sha256').update(otp).digest('hex');
  await redis.setex(otpKey(phone, purpose), OTP_TTL, hash);

  // reset attempt counter
  await redis.del(attemptsKey(phone, purpose));

  // send via Twilio (or log in dev)
  await sendOTP(phone, otp, purpose);

  // audit log
  await query(
    `INSERT INTO otp_log (phone, purpose, ip_address) VALUES ($1, $2, $3)`,
    [phone, purpose, ipAddress]
  ).catch(() => {}); // non-fatal

  return { sent: true, expiresIn: OTP_TTL };
}

/**
 * Verify an OTP.
 * @param {string} phone - phone number
 * @param {string} purpose - 'register', 'login', 'reset'
 * @param {string} code - OTP code
 * @param {boolean} consume - whether to delete the OTP after verification (default: true)
 * Returns { valid: true } or throws.
 */
async function verifyOTP(phone, purpose, code, consume = true) {
  const key      = otpKey(phone, purpose);
  const attKey   = attemptsKey(phone, purpose);

  const storedHash = await redis.get(key);

  if (!storedHash) {
    throw Object.assign(new Error('OTP expired or not found. Please request a new one.'), { status: 400 });
  }

  // increment attempt counter
  const attempts = await redis.incr(attKey);
  if (attempts === 1) await redis.expire(attKey, OTP_TTL);

  if (attempts > MAX_ATTEMPTS) {
    await redis.del(key);
    throw Object.assign(new Error('Too many incorrect attempts. Please request a new OTP.'), { status: 429 });
  }

  const inputHash = crypto.createHash('sha256').update(code).digest('hex');

  if (inputHash !== storedHash) {
    throw Object.assign(
      new Error(`Incorrect code. ${MAX_ATTEMPTS - attempts} attempt(s) remaining.`),
      { status: 400 }
    );
  }

  // valid — delete so it can't be reused (unless consume=false for check-only)
  if (consume) {
    await redis.del(key);
    await redis.del(attKey);
  }

  // update audit log
  await query(
    `UPDATE otp_log SET success = true
     WHERE phone = $1 AND purpose = $2 AND success IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    [phone, purpose]
  ).catch(() => {});

  return { valid: true };
}

module.exports = { requestOTP, verifyOTP };
