const router     = require('express').Router();
const ctrl       = require('../controllers/auth.controller');
const { validate }      = require('../middleware/validate.middleware');
const { authenticate }  = require('../middleware/auth.middleware');
const rateLimit  = require('express-rate-limit');

// tight rate limit on OTP endpoints
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 min
  max: 10,
  message: { error: 'Too many requests. Please wait 10 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 min
  max: 20,
  message: { error: 'Too many login attempts. Please try again shortly.' },
});

router.post('/otp/request', otpLimiter,   validate('requestOTP'),   ctrl.requestOTPHandler);
router.post('/otp/verify',   otpLimiter,   validate('verifyOTP'),    ctrl.handleVerifyOTP);
router.post('/register',    otpLimiter,   validate('register'),      ctrl.register);
router.post('/login',       loginLimiter, validate('login'),         ctrl.login);
router.post('/refresh',                   validate('refreshToken'),  ctrl.refresh);
router.post('/logout',      authenticate,                            ctrl.logout);
router.get ('/me',          authenticate,                            ctrl.me);

module.exports = router;
