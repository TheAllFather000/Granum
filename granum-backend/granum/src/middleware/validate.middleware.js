const Joi = require('joi');

// SA phone: 0XX XXX XXXX or +27XX XXX XXXX
const SA_PHONE_REGEX = /^(\+27|0)[6-8][0-9]{8}$/;

const schemas = {

  // ── auth ──────────────────────────────────────────────────────
  requestOTP: Joi.object({
    phone:   Joi.string().pattern(SA_PHONE_REGEX).required()
               .messages({ 'string.pattern.base': 'Enter a valid South African phone number' }),
    purpose: Joi.string().valid('register', 'login', 'reset').default('login'),
  }),

  verifyOTP: Joi.object({
    phone:   Joi.string().pattern(SA_PHONE_REGEX).required(),
    code:    Joi.string().length(6).pattern(/^\d+$/).required()
               .messages({ 'string.length': 'OTP must be 6 digits' }),
    purpose: Joi.string().valid('register', 'login', 'reset').default('login'),
  }),

  register: Joi.object({
    phone:      Joi.string().pattern(SA_PHONE_REGEX).required(),
    otp:        Joi.string().length(6).pattern(/^\d+$/).required(),
    role:       Joi.string().valid('spaza_owner','farmer','manufacturer','driver').required(),
    first_name: Joi.string().min(1).max(100).required(),
    last_name:  Joi.string().min(1).max(100).required(),
    email:      Joi.string().email().optional().allow(''),
    password:   Joi.string().min(6).max(100)
                  .optional()
                  .messages({ 'string.min': 'Password must be at least 6 characters' }),
  }),

  login: Joi.object({
    phone:   Joi.string().pattern(SA_PHONE_REGEX).required(),
    otp:     Joi.string().length(6).pattern(/^\d+$/).optional(),
    password:Joi.string().optional(),
  }).or('otp', 'password'), // at least one of OTP or password

  refreshToken: Joi.object({
    refresh_token: Joi.string().required(),
  }),

  // ── profile ───────────────────────────────────────────────────
  updateProfile: Joi.object({
    business_name: Joi.string().max(200).optional(),
    tagline:       Joi.string().max(300).optional().allow(''),
    bio:           Joi.string().max(2000).optional().allow(''),
    province:      Joi.string().valid(
      'Western Cape','Gauteng','KwaZulu-Natal','Limpopo',
      'Free State','North West','Mpumalanga','Eastern Cape','Northern Cape'
    ).optional(),
    area:          Joi.string().max(100).optional().allow(''),
    address:       Joi.string().max(500).optional().allow(''),
    trading_hours: Joi.object().optional(),
    farm_size_ha:  Joi.number().positive().optional(),
    capacity_note: Joi.string().max(200).optional().allow(''),
  }),

  updateSocialLinks: Joi.object({
    social_links: Joi.array().items(
      Joi.object({
        platform: Joi.string().valid('facebook', 'instagram', 'whatsapp', 'twitter', 'tiktok', 'website').required(),
        url:      Joi.string().uri().required(),
      })
    ).required(),
  }),

  // ── products ──────────────────────────────────────────────────
  createProduct: Joi.object({
    name:         Joi.string().min(2).max(200).required(),
    description:  Joi.string().max(1000).optional().allow(''),
    price_cents:  Joi.number().integer().positive().required(),
    unit:         Joi.string().max(50).default('each'),
    emoji:        Joi.string().max(10).optional(),
    badge:        Joi.string().max(50).optional().allow(''),
    category:     Joi.string().max(100).optional().allow(''),
    stock_qty:    Joi.number().integer().min(0).optional().allow(null),
    bulk_options: Joi.array().items(
      Joi.object({
        qty:          Joi.number().integer().positive().required(),
        discount_pct: Joi.number().min(0).max(100).required(),
      })
    ).optional(),
  }),

  updateProduct: Joi.object({
    name:         Joi.string().min(2).max(200).optional(),
    description:  Joi.string().max(1000).optional().allow(''),
    price_cents:  Joi.number().integer().positive().optional(),
    unit:         Joi.string().max(50).optional(),
    emoji:        Joi.string().max(10).optional(),
    badge:        Joi.string().max(50).optional().allow('', null),
    category:     Joi.string().max(100).optional().allow(''),
    in_stock:     Joi.boolean().optional(),
    stock_qty:    Joi.number().integer().min(0).optional().allow(null),
    bulk_options: Joi.array().optional(),
  }),

  // ── orders ────────────────────────────────────────────────────
  placeOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        product_id: Joi.string().uuid().required(),
        qty:        Joi.number().integer().positive().required(),
      })
    ).min(1).required(),
    delivery_name:     Joi.string().max(200).required(),
    delivery_phone:    Joi.string().pattern(SA_PHONE_REGEX).required(),
    delivery_address:  Joi.string().max(500).required(),
    delivery_area:     Joi.string().max(100).optional().allow(''),
    delivery_province: Joi.string().required(),
    delivery_date:     Joi.string().isoDate().required(),
    delivery_notes:    Joi.string().max(500).optional().allow(''),
    payment_method:    Joi.string().valid('card','eft','cash_on_delivery','snapscan','voucher').required(),
    voucher_code:      Joi.string().when('payment_method', {
      is: 'voucher', then: Joi.required(), otherwise: Joi.optional()
    }),
  }),

  // ── vouchers ──────────────────────────────────────────────────
  createVoucher: Joi.object({
    recipient_phone: Joi.string().pattern(SA_PHONE_REGEX).required(),
    recipient_name:  Joi.string().max(100).optional().allow(''),
    sender_name:     Joi.string().max(100).optional().allow(''),
    message:         Joi.string().max(150).optional().allow(''),
    amount_cents:    Joi.number().integer().valid(2000, 5000, 10000).required()
                       .messages({ 'any.only': 'Amount must be R20, R50, or R100' }),
  }),

  // ── reviews ───────────────────────────────────────────────────
  submitReview: Joi.object({
    stars:    Joi.number().integer().min(1).max(5).required(),
    body:     Joi.string().max(500).optional().allow(''),
    order_id: Joi.string().uuid().optional(),
  }),
};

/**
 * validate(schemaName) — returns Express middleware
 */
function validate(schemaName) {
  return (req, res, next) => {
    const schema = schemas[schemaName];
    if (!schema) return next(new Error(`Unknown schema: ${schemaName}`));

    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => ({
          field:   d.path.join('.'),
          message: d.message,
        })),
      });
    }

    req.body = value; // use stripped/coerced values
    next();
  };
}

module.exports = { validate, schemas, SA_PHONE_REGEX };
