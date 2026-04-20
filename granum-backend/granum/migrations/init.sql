-- ================================================================
--  Linkhive database schema
--  PostgreSQL 16
-- ================================================================

-- extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── ENUMS ────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'spaza_owner',
  'farmer',
  'manufacturer',
  'driver',
  'admin'
);

CREATE TYPE account_status AS ENUM (
  'pending_verification',
  'active',
  'suspended',
  'banned'
);

CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled',
  'refunded'
);

CREATE TYPE payment_method AS ENUM (
  'card',
  'eft',
  'cash_on_delivery',
  'snapscan',
  'voucher'
);

CREATE TYPE payment_status AS ENUM (
  'pending',
  'paid',
  'failed',
  'refunded'
);

CREATE TYPE voucher_status AS ENUM (
  'active',
  'partially_used',
  'fully_used',
  'expired'
);

CREATE TYPE province AS ENUM (
  'Western Cape',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Free State',
  'North West',
  'Mpumalanga',
  'Eastern Cape',
  'Northern Cape'
);

-- ── USERS ────────────────────────────────────────────────────────

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(20) UNIQUE NOT NULL,
  email           VARCHAR(255) UNIQUE,
  password_hash   VARCHAR(255),              -- null until password is set
  first_name      VARCHAR(100),
  last_name       VARCHAR(100),
  role            user_role NOT NULL,
  status          account_status NOT NULL DEFAULT 'pending_verification',
  phone_verified  BOOLEAN NOT NULL DEFAULT false,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REFRESH TOKENS ───────────────────────────────────────────────

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(255) UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PROFILES ─────────────────────────────────────────────────────
-- One profile per user — stores role-specific data

CREATE TABLE profiles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name VARCHAR(200),
  tagline       VARCHAR(300),
  bio           TEXT,
  cover_url     TEXT,
  province      province,
  area          VARCHAR(100),
  address       TEXT,
  latitude      DECIMAL(9,6),
  longitude     DECIMAL(9,6),
  -- opening hours stored as JSONB for flexibility
  -- e.g. {"mon":{"open":"06:00","close":"20:00"},"sun":"closed"}
  trading_hours JSONB,
  -- role-specific fields
  farm_size_ha  DECIMAL(8,2),          -- farmers only
  capacity_note VARCHAR(200),          -- manufacturers only
  verified      BOOLEAN NOT NULL DEFAULT false,
  verified_at   TIMESTAMPTZ,
  rating_sum    INTEGER NOT NULL DEFAULT 0,
  rating_count  INTEGER NOT NULL DEFAULT 0,
  -- social media links (stored as JSONB array)
  -- e.g. [{"platform":"facebook","url":"https://..."}]
  social_links  JSONB DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── PRODUCTS ─────────────────────────────────────────────────────

CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name         VARCHAR(200) NOT NULL,
  description  TEXT,
  price_cents  INTEGER NOT NULL,          -- price in cents to avoid float issues
  unit         VARCHAR(50) NOT NULL DEFAULT 'each',
  emoji        VARCHAR(10) DEFAULT '📦',
  image_url    TEXT,
  badge        VARCHAR(50),
  category     VARCHAR(100),
  in_stock     BOOLEAN NOT NULL DEFAULT true,
  stock_qty    INTEGER,                   -- null means unlimited
  -- bulk pricing: [{qty:5,discount_pct:10},{qty:10,discount_pct:15}]
  bulk_options JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDERS ───────────────────────────────────────────────────────

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id          UUID NOT NULL REFERENCES users(id),
  order_number      VARCHAR(20) UNIQUE NOT NULL,  -- LH-XXXXXX
  status            order_status NOT NULL DEFAULT 'pending',
  -- delivery info
  delivery_name     VARCHAR(200),
  delivery_phone    VARCHAR(20),
  delivery_address  TEXT,
  delivery_area     VARCHAR(100),
  delivery_province province,
  delivery_date     DATE,
  delivery_notes    TEXT,
  -- financials (all in cents)
  subtotal_cents    INTEGER NOT NULL DEFAULT 0,
  discount_cents    INTEGER NOT NULL DEFAULT 0,
  delivery_cents    INTEGER NOT NULL DEFAULT 2500,  -- R25 default
  total_cents       INTEGER NOT NULL DEFAULT 0,
  -- payment
  payment_method    payment_method,
  payment_status    payment_status NOT NULL DEFAULT 'pending',
  -- timestamps
  placed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at      TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ORDER ITEMS ──────────────────────────────────────────────────

CREATE TABLE order_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  seller_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  product_name VARCHAR(200) NOT NULL,   -- snapshot at time of order
  unit         VARCHAR(50),
  qty          INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL,   -- snapshot
  subtotal_cents   INTEGER NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── REVIEWS ──────────────────────────────────────────────────────

CREATE TABLE reviews (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  order_id     UUID REFERENCES orders(id) ON DELETE SET NULL,
  stars        SMALLINT NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (profile_id, reviewer_id, order_id)
);

-- ── VOUCHERS ─────────────────────────────────────────────────────

CREATE TABLE vouchers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(30) UNIQUE NOT NULL,
  created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_phone VARCHAR(20),
  recipient_name  VARCHAR(100),
  sender_name     VARCHAR(100),
  message         TEXT,
  initial_cents   INTEGER NOT NULL,
  balance_cents   INTEGER NOT NULL,
  status          voucher_status NOT NULL DEFAULT 'active',
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '12 months',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── VOUCHER REDEMPTIONS ──────────────────────────────────────────

CREATE TABLE voucher_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id   UUID NOT NULL REFERENCES vouchers(id),
  order_id     UUID REFERENCES orders(id),
  amount_cents INTEGER NOT NULL,
  redeemed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── OTP AUDIT LOG ─────────────────────────────────────────────
-- Redis holds live OTPs; this table logs attempts for security

CREATE TABLE otp_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      VARCHAR(20) NOT NULL,
  purpose    VARCHAR(50) NOT NULL,  -- 'register' | 'login' | 'reset'
  success    BOOLEAN,
  ip_address INET,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────

CREATE INDEX idx_users_phone         ON users(phone);
CREATE INDEX idx_users_role          ON users(role);
CREATE INDEX idx_profiles_user       ON profiles(user_id);
CREATE INDEX idx_profiles_province   ON profiles(province);
CREATE INDEX idx_profiles_verified   ON profiles(verified);
CREATE INDEX idx_products_profile    ON products(profile_id);
CREATE INDEX idx_products_category   ON products(category);
CREATE INDEX idx_products_in_stock   ON products(in_stock);
CREATE INDEX idx_orders_buyer        ON orders(buyer_id);
CREATE INDEX idx_orders_status       ON orders(status);
CREATE INDEX idx_orders_number       ON orders(order_number);
CREATE INDEX idx_order_items_order   ON order_items(order_id);
CREATE INDEX idx_reviews_profile     ON reviews(profile_id);
CREATE INDEX idx_vouchers_code       ON vouchers(code);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);

-- ── UPDATED_AT TRIGGER ────────────────────────────────────────

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ── SEED: admin user (password: Admin@123) ───────────────────────
-- bcrypt hash of 'Admin@123' with salt rounds 12
INSERT INTO users (phone, email, first_name, last_name, role, status, phone_verified, password_hash)
VALUES (
  '+27000000000',
  'admin@linkhive.co.za',
  'Linkhive',
  'Admin',
  'admin',
  'active',
  true,
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewMQqr0h4y9c4.7u'
) ON CONFLICT DO NOTHING;

-- Add social_links column if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '[]';

-- ── STOCK RESCUE: REQUESTS ────────────────────────────────────────

CREATE TABLE rescue_requests (
  id              VARCHAR(50) PRIMARY KEY,
  product         VARCHAR(200) NOT NULL,
  quantity       INTEGER NOT NULL,
  unit            VARCHAR(50) NOT NULL,
  location        VARCHAR(100) NOT NULL,
  urgency         VARCHAR(20) NOT NULL DEFAULT 'tomorrow',
  willing_to_pay VARCHAR(50),
  shop_name      VARCHAR(200) NOT NULL,
  contact_phone  VARCHAR(20) NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- ── STOCK RESCUE: OFFERS ────────────────────────────────────────────────

CREATE TABLE rescue_offers (
  id             VARCHAR(50) PRIMARY KEY,
  product        VARCHAR(200) NOT NULL,
  quantity      INTEGER NOT NULL,
  unit           VARCHAR(50) NOT NULL,
  location       VARCHAR(100) NOT NULL,
  price          VARCHAR(50),
  shop_name     VARCHAR(200) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status        VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- ── STOCK RESCUE: MATCHES ───────────────────────────────────────────

CREATE TABLE rescue_matches (
  match_id     VARCHAR(50) PRIMARY KEY,
  request_id  VARCHAR(50) REFERENCES rescue_requests(id),
  offer_id    VARCHAR(50) REFERENCES rescue_offers(id),
  matched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status      VARCHAR(20) NOT NULL DEFAULT 'active'
);

-- ── INDEXES FOR RESCUE ────────────────────────────────────────────

CREATE INDEX idx_rescue_requests_location ON rescue_requests(location);
CREATE INDEX idx_rescue_requests_status ON rescue_requests(status);
CREATE INDEX idx_rescue_offers_location ON rescue_offers(location);
CREATE INDEX idx_rescue_offers_status ON rescue_offers(status);
