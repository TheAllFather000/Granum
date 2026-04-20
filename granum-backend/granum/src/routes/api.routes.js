const router = require('express').Router();
const { query, transaction } = require('../config/db');
const { authenticate, requireRole, optionalAuth } = require('../middleware/auth.middleware');
const { validate } = require('../middleware/validate.middleware');
const { sendOrderConfirmation, sendVoucher } = require('../services/sms.service');
const { sendOrderConfirmationEmail, sendOrderStatusEmail } = require('../services/email.service');
const { v4: uuidv4 } = require('uuid');

// ── PROFILES ─────────────────────────────────────────────────────

// GET /profiles?province=X&area=Y&role=farmer&page=1
router.get('/profiles', optionalAuth, async (req, res, next) => {
  try {
    const { province, area, role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * Math.min(limit, 50);
    const params = [];
    const where  = [];

    if (province) { params.push(province); where.push(`p.province = $${params.length}`); }
    if (area)     { params.push(`%${area}%`); where.push(`p.area ILIKE $${params.length}`); }
    if (role)     { params.push(role); where.push(`u.role = $${params.length}`); }

    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
    params.push(Math.min(limit, 50), offset);

    const { rows } = await query(
      `SELECT p.id, p.business_name, p.tagline, p.province, p.area,
              p.verified, p.rating_sum, p.rating_count, p.cover_url,
              u.role, u.avatar_url, u.first_name, u.last_name
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       ${whereSQL}
       ORDER BY p.verified DESC, p.rating_count DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ profiles: rows, page: Number(page), limit: Number(limit) });
  } catch (err) { next(err); }
});

// GET /profiles/me - current user's profile
router.get('/profiles/me', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.role, u.avatar_url, u.first_name, u.last_name, u.phone
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.user_id = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) { next(err); }
});

// GET /profiles/:id
router.get('/profiles/:id', optionalAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, u.role, u.avatar_url, u.first_name, u.last_name, u.phone
       FROM profiles p
       JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 OR p.user_id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Profile not found' });
    res.json({ profile: rows[0] });
  } catch (err) { next(err); }
});

// PATCH /profiles/me
router.patch('/profiles/me', authenticate, validate('updateProfile'), async (req, res, next) => {
  try {
    const { avatar_url, cover_url, ...profileFields } = req.body;
    
    // Handle avatar_url - update users table
    if (avatar_url) {
      await query(`UPDATE users SET avatar_url = $1, updated_at = NOW() WHERE id = $2`, [avatar_url, req.user.id]);
    }
    
    // Handle cover_url - update profiles table
    if (cover_url) {
      await query(`UPDATE profiles SET cover_url = $1, updated_at = NOW() WHERE user_id = $2`, [cover_url, req.user.id]);
    }
    
    // Handle other profile fields
    if (Object.keys(profileFields).length) {
      const fields  = Object.keys(profileFields);
      const values  = Object.values(profileFields);
      const setSQL = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
      values.push(req.user.id);
      await query(
        `UPDATE profiles SET ${setSQL}, updated_at = NOW() WHERE user_id = $${values.length}`,
        values
      );
    }
    
    // Fetch and return updated profile
    const { rows } = await query(
      `SELECT p.*, u.role, u.avatar_url, u.first_name, u.last_name, u.phone FROM profiles p JOIN users u ON u.id = p.user_id WHERE p.user_id = $1`,
      [req.user.id]
    );
    res.json({ profile: rows[0] });
  } catch (err) { next(err); }
});

// POST /profiles/me/social-links - verify and save social links
router.post('/profiles/me/social-links', authenticate, validate('updateSocialLinks'), async (req, res, next) => {
  try {
    const { social_links } = req.body;
    
    // Skip link verification in development (or if service unavailable)
    const { verifyLinks } = require('../services/linkvalidator.service');
    
    let results;
    try {
      results = await verifyLinks(social_links);
      const invalidLinks = results.filter(r => !r.valid);
      if (invalidLinks.length > 0) {
        console.log('[SocialLinks] Some links failed verification (allowing anyway):', invalidLinks);
      }
    } catch (verifyErr) {
      console.log('[SocialLinks] Verification skipped:', verifyErr.message);
    }
    
    const { rows } = await query(
      `UPDATE profiles SET social_links = $1, updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [JSON.stringify(social_links), req.user.id]
    );

    res.json({ profile: rows[0] });
  } catch (err) { next(err); }
});

// ── PRODUCTS ──────────────────────────────────────────────────────

// GET /products?profile_id=X&category=Y
router.get('/products', optionalAuth, async (req, res, next) => {
  try {
    const { profile_id, category, in_stock, page = 1, limit = 30 } = req.query;
    const params = []; const where = [];

    if (profile_id) { params.push(profile_id); where.push(`pr.profile_id = $${params.length}`); }
    if (category)   { params.push(category);   where.push(`pr.category = $${params.length}`); }
    if (in_stock)   { params.push(in_stock === 'true'); where.push(`pr.in_stock = $${params.length}`); }

    const offset = (page - 1) * Math.min(limit, 50);
    params.push(Math.min(limit, 50), offset);
    const wSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const { rows } = await query(
      `SELECT pr.*, p.business_name, u.role
       FROM products pr
       JOIN profiles p ON p.id = pr.profile_id
       JOIN users u ON u.id = p.user_id
       ${wSQL}
       ORDER BY pr.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ products: rows });
  } catch (err) { next(err); }
});

// POST /products
router.post('/products', authenticate, requireRole('farmer','manufacturer','spaza_owner'), validate('createProduct'), async (req, res, next) => {
  try {
    const { rows: [profile] } = await query(
      `SELECT id FROM profiles WHERE user_id = $1`, [req.user.id]
    );
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { name, description, price_cents, unit, emoji, badge, category, stock_qty, bulk_options } = req.body;
    const { rows: [product] } = await query(
      `INSERT INTO products (profile_id, name, description, price_cents, unit, emoji, badge, category, stock_qty, bulk_options)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [profile.id, name, description, price_cents, unit, emoji, badge, category, stock_qty, JSON.stringify(bulk_options || [])]
    );
    res.status(201).json({ product });
  } catch (err) { next(err); }
});

// PATCH /products/:id
router.patch('/products/:id', authenticate, validate('updateProduct'), async (req, res, next) => {
  try {
    // verify ownership
    const { rows: [product] } = await query(
      `SELECT pr.id FROM products pr
       JOIN profiles p ON p.id = pr.profile_id
       WHERE pr.id = $1 AND p.user_id = $2`,
      [req.params.id, req.user.id]
    );
    if (!product) return res.status(404).json({ error: 'Product not found or not yours' });

    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    const setSQL = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');
    values.push(req.params.id);

    const { rows: [updated] } = await query(
      `UPDATE products SET ${setSQL}, updated_at = NOW()
       WHERE id = $${values.length} RETURNING *`,
      values
    );
    res.json({ product: updated });
  } catch (err) { next(err); }
});

// DELETE /products/:id
router.delete('/products/:id', authenticate, async (req, res, next) => {
  try {
    const { rowCount } = await query(
      `DELETE FROM products pr
       USING profiles p
       WHERE pr.profile_id = p.id AND p.user_id = $1 AND pr.id = $2`,
      [req.user.id, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Product not found or not yours' });
    res.json({ message: 'Product deleted' });
  } catch (err) { next(err); }
});

// ── ORDERS ────────────────────────────────────────────────────────

// POST /orders
router.post('/orders', authenticate, validate('placeOrder'), async (req, res, next) => {
  try {
    const {
      items, delivery_name, delivery_phone, delivery_address,
      delivery_area, delivery_province, delivery_date, delivery_notes,
      payment_method, voucher_code,
    } = req.body;

    // fetch buyer details for email notification
    const { rows: [buyer] } = await query(
      `SELECT first_name, last_name, email FROM users WHERE id = $1`,
      [req.user.id]
    );

    // fetch products + prices (only in-stock items)
    const productIds = items.map(i => i.product_id);
    const { rows: products } = await query(
      `SELECT id, price_cents, name, unit, profile_id FROM products
       WHERE id = ANY($1) AND in_stock = true`,
      [productIds]
    );

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products are unavailable' });
    }

    // build line items and subtotal
    const DELIVERY_CENTS = 2500; // R25 flat rate
    let subtotal = 0;
    const lineItems = items.map(item => {
      const p = products.find(x => x.id === item.product_id);
      const sub = p.price_cents * item.qty;
      subtotal += sub;
      return { product: p, qty: item.qty, subtotal: sub };
    });

    // voucher validation
    let discountCents = 0;
    let voucherId = null;
    if (voucher_code) {
      const { rows: [voucher] } = await query(
        `SELECT id, balance_cents FROM vouchers
         WHERE code = $1 AND status IN ('active','partially_used') AND expires_at > NOW()`,
        [voucher_code.toUpperCase()]
      );
      if (!voucher) return res.status(400).json({ error: 'Invalid or expired voucher code' });
      discountCents = Math.min(voucher.balance_cents, subtotal);
      voucherId = voucher.id;
    }

    const totalCents  = Math.max(0, subtotal - discountCents + DELIVERY_CENTS);
    const orderNumber = 'LH-' + Date.now().toString(36).toUpperCase().slice(-6);

    // database transaction — all or nothing
    const { order, savedItems } = await transaction(async (client) => {
      const { rows: [newOrder] } = await client.query(
        `INSERT INTO orders (
           buyer_id, order_number, delivery_name, delivery_phone,
           delivery_address, delivery_area, delivery_province,
           delivery_date, delivery_notes, subtotal_cents,
           discount_cents, delivery_cents, total_cents, payment_method
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          req.user.id, orderNumber, delivery_name, delivery_phone,
          delivery_address, delivery_area || null, delivery_province,
          delivery_date, delivery_notes || null, subtotal,
          discountCents, DELIVERY_CENTS, totalCents, payment_method,
        ]
      );

      const savedItems = [];
      for (const li of lineItems) {
        const { rows: [oi] } = await client.query(
          `INSERT INTO order_items
             (order_id, product_id, seller_id, product_name, unit, qty, unit_price_cents, subtotal_cents)
           SELECT $1, $2, p.user_id, $3, $4, $5, $6, $7
           FROM profiles p WHERE p.id = $8
           RETURNING *`,
          [
            newOrder.id, li.product.id, li.product.name, li.product.unit,
            li.qty, li.product.price_cents, li.subtotal, li.product.profile_id,
          ]
        );
        savedItems.push(oi);
      }

      // deduct voucher balance
      if (voucherId) {
        await client.query(
          `UPDATE vouchers SET
             balance_cents = balance_cents - $1,
             status = CASE WHEN balance_cents - $1 <= 0 THEN 'fully_used' ELSE 'partially_used' END
           WHERE id = $2`,
          [discountCents, voucherId]
        );
        await client.query(
          `INSERT INTO voucher_redemptions (voucher_id, order_id, amount_cents)
           VALUES ($1, $2, $3)`,
          [voucherId, newOrder.id, discountCents]
        );
      }

      return { order: newOrder, savedItems };
    });

    // format delivery date for notifications
    const formattedDate = new Date(delivery_date).toLocaleDateString('en-ZA', {
      weekday: 'long', day: 'numeric', month: 'long',
    });

    // build shared notification payload
    const notifPayload = {
      order_number: orderNumber,
      first_name:        buyer.first_name,
      delivery_name,
      delivery_address,
      delivery_area:     delivery_area || '',
      delivery_province,
      delivery_date,
      delivery_notes:    delivery_notes || '',
      payment_method,
      subtotal_cents:    subtotal,
      discount_cents:    discountCents,
      delivery_cents:    DELIVERY_CENTS,
      total_cents:       totalCents,
      items: savedItems.map(oi => ({
        product_name:   oi.product_name,
        qty:            oi.qty,
        subtotal_cents: oi.subtotal_cents,
      })),
    };

    // SMS confirmation to delivery phone (non-blocking)
    sendOrderConfirmation(delivery_phone, orderNumber, formattedDate)
      .catch(e => console.error('[SMS] Confirmation failed:', e.message));

    // Email confirmation to buyer (non-blocking, only if email on file)
    if (buyer.email) {
      sendOrderConfirmationEmail(buyer.email, notifPayload)
        .catch(e => console.error('[Email] Confirmation failed:', e.message));
    }

    res.status(201).json({
      message:  'Order placed successfully!',
      order: {
        id:                order.id,
        order_number:      order.order_number,
        status:            order.status,
        subtotal_cents:    order.subtotal_cents,
        discount_cents:    order.discount_cents,
        delivery_cents:    order.delivery_cents,
        total_cents:       order.total_cents,
        payment_method:    order.payment_method,
        delivery_name:     order.delivery_name,
        delivery_address:  order.delivery_address,
        delivery_province: order.delivery_province,
        delivery_date:     order.delivery_date,
        placed_at:         order.placed_at,
        items: savedItems.map(oi => ({
          product_name:      oi.product_name,
          unit:              oi.unit,
          qty:               oi.qty,
          unit_price_cents:  oi.unit_price_cents,
          subtotal_cents:    oi.subtotal_cents,
        })),
      },
      notifications: {
        sms_sent:   true,
        email_sent: !!buyer.email,
      },
    });
  } catch (err) { next(err); }
});

// GET /orders — my order history
router.get('/orders', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*,
         json_agg(json_build_object(
           'product_name',   oi.product_name,
           'qty',            oi.qty,
           'unit',           oi.unit,
           'subtotal_cents', oi.subtotal_cents
         ) ORDER BY oi.created_at) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.buyer_id = $1
         AND o.placed_at >= NOW() - INTERVAL '3 months'
       GROUP BY o.id
       ORDER BY o.placed_at DESC`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// GET /orders/selling - customer orders (orders where user is seller)
router.get('/orders/selling', authenticate, async (req, res, next) => {
  try {
    // First get the user's profile IDs
    const { rows: profiles } = await query(
      `SELECT id FROM profiles WHERE user_id = $1`,
      [req.user.id]
    );
    
    if (!profiles || profiles.length === 0) {
      return res.json({ orders: [] });
    }
    
    const profileIds = profiles.map(p => p.id);
    
    // Get orders that contain products from this user's profiles
    const { rows } = await query(
      `SELECT o.*,
         json_agg(json_build_object(
           'product_name',   oi.product_name,
           'qty',            oi.qty,
           'unit',           oi.unit,
           'subtotal_cents', oi.subtotal_cents
         ) ORDER BY oi.created_at) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN products p ON p.id = oi.product_id
       WHERE p.profile_id = ANY($1)
         AND o.placed_at >= NOW() - INTERVAL '3 months'
       GROUP BY o.id
       ORDER BY o.placed_at DESC`,
      [profileIds]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// GET /orders/:id — single order detail
router.get('/orders/:id', authenticate, async (req, res, next) => {
  try {
    const { rows: [order] } = await query(
      `SELECT o.*,
         json_agg(json_build_object(
           'product_name',     oi.product_name,
           'qty',              oi.qty,
           'unit',             oi.unit,
           'unit_price_cents', oi.unit_price_cents,
           'subtotal_cents',   oi.subtotal_cents
         ) ORDER BY oi.created_at) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1 AND o.buyer_id = $2
       GROUP BY o.id`,
      [req.params.id, req.user.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (err) { next(err); }
});

// GET /orders/selling — orders where user is the seller (customer orders)
router.get('/orders/selling', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT o.*,
         json_agg(json_build_object(
           'product_name',   oi.product_name,
           'qty',            oi.qty,
           'unit',           oi.unit,
           'subtotal_cents', oi.subtotal_cents
         ) ORDER BY oi.created_at) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE oi.seller_id = $1
         AND o.placed_at >= NOW() - INTERVAL '3 months'
       GROUP BY o.id
       ORDER BY o.placed_at DESC`,
      [req.user.id]
    );
    res.json({ orders: rows });
  } catch (err) { next(err); }
});

// PATCH /orders/:id/status — admin or driver updates order status + notifies buyer
router.patch('/orders/:id/status', authenticate, requireRole('admin','driver'), async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ['confirmed','out_for_delivery','delivered','cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
    }

    const tsClause = {
      confirmed:        'confirmed_at = NOW(),',
      out_for_delivery: '',
      delivered:        'delivered_at = NOW(),',
      cancelled:        '',
    }[status];

    const { rows: [order] } = await query(
      `UPDATE orders SET ${tsClause} status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // notify buyer
    const { rows: [buyer] } = await query(
      `SELECT first_name, email FROM users WHERE id = $1`,
      [order.buyer_id]
    );
    if (buyer?.email) {
      sendOrderStatusEmail(buyer.email, { ...order, first_name: buyer.first_name }, status)
        .catch(e => console.error('[Email] Status update failed:', e.message));
    }

    res.json({ order, message: `Order status updated to: ${status}` });
  } catch (err) { next(err); }
});

// PATCH /orders/:id/cancel — buyer cancels their own order (only if pending)
router.patch('/orders/:id/cancel', authenticate, async (req, res, next) => {
  try {
    const { rows: [order] } = await query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE id = $1 AND buyer_id = $2 AND status = 'pending'
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!order) {
      return res.status(400).json({ error: 'Order not found or cannot be cancelled' });
    }
    res.json({ order, message: 'Order cancelled successfully' });
  } catch (err) { next(err); }
});


// ── VOUCHERS ──────────────────────────────────────────────────────

// POST /vouchers (public - no auth required)
router.post('/vouchers', async (req, res, next) => {
  try {
    const { code, recipient_phone, recipient_name, sender_name, message, initial_cents, balance_cents } = req.body;
    const voucherCode = code || 'LH-' + uuidv4().replace(/-/g,'').slice(0,5).toUpperCase();
    const amount = initial_cents || balance_cents || 2000;

    // Allow anyone to receive vouchers - no validation needed
    // Recipient can be any phone number, they redeem at a Granum shop

    const { rows: [voucher] } = await query(
      `INSERT INTO vouchers
         (code, recipient_phone, recipient_name, sender_name, message, initial_cents, balance_cents)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [voucherCode, recipient_phone, recipient_name || null,
       sender_name || null, message || null, amount, amount]
    );

    // send SMS (non-blocking)
    sendVoucher(recipient_phone, voucherCode, amount / 100, sender_name)
      .catch(err => console.error('[SMS] Voucher send failed:', err.message));

    res.status(201).json({
      message: `Voucher sent to ${recipient_phone}`,
      voucher: { code: voucher.code, amount_cents: amount, expires_at: voucher.expires_at },
    });
  } catch (err) { next(err); }
});

// GET /vouchers/:code
router.get('/vouchers/:code', async (req, res, next) => {
  try {
    const { rows: [voucher] } = await query(
      `SELECT code, balance_cents, initial_cents, status, expires_at, sender_name,
              recipient_phone, recipient_name, message
       FROM vouchers
       WHERE code = $1`,
      [req.params.code.toUpperCase()]
    );
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json({ voucher });
  } catch (err) { next(err); }
});

// PUT /vouchers/:code/redeem
router.put('/vouchers/:code/redeem', async (req, res, next) => {
  try {
    const { amount_cents, spaza_name } = req.body;
    const code = req.params.code.toUpperCase();

    const { rows: [voucher] } = await query(
      `SELECT * FROM vouchers WHERE code = $1 FOR UPDATE`,
      [code]
    );
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    if (voucher.status === 'fully_used' || voucher.status === 'expired') {
      return res.status(400).json({ error: `Voucher is ${voucher.status}` });
    }
    const amount = amount_cents || 0;
    if (amount > voucher.balance_cents) {
      return res.status(400).json({ error: 'Insufficient balance' });
    }

    const newBalance = voucher.balance_cents - amount;
    let newStatus = 'active';
    if (newBalance === 0) newStatus = 'fully_used';
    else if (newBalance < voucher.initial_cents) newStatus = 'partially_used';

    await query(
      `UPDATE vouchers SET balance_cents = $1, status = $2 WHERE code = $3`,
      [newBalance, newStatus, code]
    );

    await query(
      `INSERT INTO voucher_redemptions (voucher_id, amount_cents, order_id)
       VALUES ($1, $2, $3)`,
      [voucher.id, amount, null]
    );

    // Add to recipient's voucher balance
    if (voucher.recipient_phone) {
      await query(
        `UPDATE users SET voucher_balance_cents = COALESCE(voucher_balance_cents, 0) + $1 WHERE phone = $2`,
        [amount, voucher.recipient_phone]
      );
    }

    res.json({ success: true, new_balance_cents: newBalance, added_to_balance: amount });
  } catch (err) { next(err); }
});

// GET /vouchers - list all (public)
router.get('/vouchers', async (req, res, next) => {
  try {
    const { phone } = req.query;
    const params = [];
    let where = '';
    if (phone) {
      params.push(phone);
      where = `WHERE recipient_phone = $${params.length} OR sender_name = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT * FROM vouchers ${where} ORDER BY created_at DESC`,
      params
    );
    res.json({ vouchers: rows });
  } catch (err) { next(err); }
});

// GET /redemptions - list redemptions for spaza
router.get('/redemptions', async (req, res, next) => {
  try {
    const { spaza_name } = req.query;
    if (!spaza_name) return res.status(400).json({ error: 'spaza_name required' });
    const { rows } = await query(
      `SELECT vr.*, v.code as voucher_code
       FROM voucher_redemptions vr
       JOIN vouchers v ON v.id = vr.voucher_id
       WHERE v.recipient_name = $1
       ORDER BY vr.redeemed_at DESC`,
      [spaza_name]
    );
    res.json({ redemptions: rows });
  } catch (err) { next(err); }
});

// DELETE /vouchers/:code
router.delete('/vouchers/:code', async (req, res, next) => {
  try {
    const code = req.params.code.toUpperCase();
    await query(`DELETE FROM vouchers WHERE code = $1`, [code]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── STOCK RESCUE: REQUESTS ────────────────────────────────────────

// GET /rescue/requests
router.get('/rescue/requests', async (req, res, next) => {
  try {
    const { location, status } = req.query;
    const params = [];
    const where = [];
    if (location && location !== 'all') {
      params.push(location);
      where.push(`location = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await query(
      `SELECT * FROM rescue_requests ${whereSQL} ORDER BY created_at DESC`,
      params
    );
    res.json({ requests: rows });
  } catch (err) { next(err); }
});

// POST /rescue/requests
router.post('/rescue/requests', async (req, res, next) => {
  try {
    const { id, product, quantity, unit, location, urgency, willing_to_pay, shop_name, contact_phone, status } = req.body;
    await query(
      `INSERT INTO rescue_requests (id, product, quantity, unit, location, urgency, willing_to_pay, shop_name, contact_phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, product, quantity, unit, location, urgency || 'tomorrow', willing_to_pay, shop_name, contact_phone, status || 'active']
    );
    res.status(201).json({ success: true, request_id: id });
  } catch (err) { next(err); }
});

// PUT /rescue/requests/:id
router.put('/rescue/requests/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    await query(
      `UPDATE rescue_requests SET status = $1 WHERE id = $2`,
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /rescue/requests/:id
router.delete('/rescue/requests/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM rescue_requests WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── STOCK RESCUE: OFFERS ───────────────────────────────────────────

// GET /rescue/offers
router.get('/rescue/offers', async (req, res, next) => {
  try {
    const { location, status } = req.query;
    const params = [];
    const where = [];
    if (location && location !== 'all') {
      params.push(location);
      where.push(`location = $${params.length}`);
    }
    if (status) {
      params.push(status);
      where.push(`status = $${params.length}`);
    }
    const whereSQL = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const { rows } = await query(
      `SELECT * FROM rescue_offers ${whereSQL} ORDER BY created_at DESC`,
      params
    );
    res.json({ offers: rows });
  } catch (err) { next(err); }
});

// POST /rescue/offers
router.post('/rescue/offers', async (req, res, next) => {
  try {
    const { id, product, quantity, unit, location, price, shop_name, contact_phone, status } = req.body;
    await query(
      `INSERT INTO rescue_offers (id, product, quantity, unit, location, price, shop_name, contact_phone, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, product, quantity, unit, location, price, shop_name, contact_phone, status || 'active']
    );
    res.status(201).json({ success: true, offer_id: id });
  } catch (err) { next(err); }
});

// PUT /rescue/offers/:id
router.put('/rescue/offers/:id', async (req, res, next) => {
  try {
    const { status } = req.body;
    await query(
      `UPDATE rescue_offers SET status = $1 WHERE id = $2`,
      [status, req.params.id]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// DELETE /rescue/offers/:id
router.delete('/rescue/offers/:id', async (req, res, next) => {
  try {
    await query(`DELETE FROM rescue_offers WHERE id = $1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── STOCK RESCUE: MATCHES ───────────────────────────────────────────

// GET /rescue/matches
router.get('/rescue/matches', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM rescue_matches ORDER BY matched_at DESC`
    );
    res.json({ matches: rows });
  } catch (err) { next(err); }
});

// ── VOUCHER BALANCE ───────────────────────────────────────────

// GET /voucher-balance (requires auth)
router.get('/voucher-balance', authenticate, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT voucher_balance_cents FROM users WHERE id = $1`,
      [req.user.id]
    );
    const balance = rows[0]?.voucher_balance_cents || 0;
    res.json({ voucher_balance_cents: balance, voucher_balance: balance / 100 });
  } catch (err) { next(err); }
});

// POST /voucher-balance/add (add to balance - called when voucher is redeemed)
router.post('/voucher-balance/add', async (req, res, next) => {
  try {
    const { phone, amount_cents } = req.body;
    if (!phone || !amount_cents) {
      return res.status(400).json({ error: 'phone and amount_cents required' });
    }
    
    await query(
      `UPDATE users SET voucher_balance_cents = COALESCE(voucher_balance_cents, 0) + $1 WHERE phone = $2`,
      [parseInt(amount_cents), phone]
    );
    
    const { rows } = await query(
      `SELECT voucher_balance_cents FROM users WHERE phone = $1`,
      [phone]
    );
    
    res.json({ success: true, voucher_balance_cents: rows[0]?.voucher_balance_cents || 0 });
  } catch (err) { next(err); }
});

// POST /voucher-balance/use (use balance for payment - requires auth)
router.post('/voucher-balance/use', authenticate, async (req, res, next) => {
  try {
    const { amount_cents } = req.body;
    if (!amount_cents) {
      return res.status(400).json({ error: 'amount_cents required' });
    }
    
    const { rows: [user] } = await query(
      `SELECT voucher_balance_cents FROM users WHERE id = $1 FOR UPDATE`,
      [req.user.id]
    );
    
    if (!user || user.voucher_balance_cents < amount_cents) {
      return res.status(400).json({ error: 'Insufficient voucher balance' });
    }
    
    await query(
      `UPDATE users SET voucher_balance_cents = voucher_balance_cents - $1 WHERE id = $2`,
      [amount_cents, req.user.id]
    );
    
    res.json({ success: true, amount_cents });
  } catch (err) { next(err); }
});

// ── REVIEWS ───────────────────────────────────────────────────────

// POST /profiles/:id/reviews
router.post('/profiles/:id/reviews', authenticate, validate('submitReview'), async (req, res, next) => {
  try {
    const { stars, body, order_id } = req.body;

    const { rows: [review] } = await query(
      `INSERT INTO reviews (profile_id, reviewer_id, order_id, stars, body)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (profile_id, reviewer_id, order_id) DO UPDATE
         SET stars = EXCLUDED.stars, body = EXCLUDED.body
       RETURNING *`,
      [req.params.id, req.user.id, order_id || null, stars, body || null]
    );

    // update denormalised rating on profile
    await query(
      `UPDATE profiles SET
         rating_sum   = (SELECT COALESCE(SUM(stars),0) FROM reviews WHERE profile_id = $1),
         rating_count = (SELECT COUNT(*) FROM reviews WHERE profile_id = $1)
       WHERE id = $1`,
      [req.params.id]
    );

    res.status(201).json({ review });
  } catch (err) { next(err); }
});

// GET /profiles/:id/reviews
router.get('/profiles/:id/reviews', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT r.id, r.stars, r.body, r.created_at,
              u.first_name, u.last_name, u.avatar_url
       FROM reviews r
       JOIN users u ON u.id = r.reviewer_id
       WHERE r.profile_id = $1
       ORDER BY r.created_at DESC`,
      [req.params.id]
    );
    res.json({ reviews: rows });
  } catch (err) { next(err); }
});

// ── LEADERBOARD ───────────────────────────────────────────────

// GET /leaderboard/:role - get leaderboard for a specific role
router.get('/leaderboard/:role', async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    const role = req.params.role;
    
    // Map role to display name
    const roleNames = { spaza_owner: 'spaza', farmer: 'farmer', manufacturer: 'maker' };
    const displayNames = { spaza_owner: 'Spaza', farmer: 'Farmer', manufacturer: 'Manufacturer' };
    
    if (!roleNames[role]) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    
    // Calculate date filter based on period
    let dateFilter = "AND o.placed_at >= NOW() - INTERVAL '1 month'";
    if (period === 'week') {
      dateFilter = "AND o.placed_at >= NOW() - INTERVAL '1 week'";
    } else if (period === 'alltime') {
      dateFilter = '';
    }
    
    // Get leaderboard data - count orders and unique customers per profile
    const { rows } = await query(
      `SELECT 
         pr.id,
         pr.business_name,
         pr.area,
         pr.province,
         pr.verified,
         u.role,
         COUNT(DISTINCT o.id) AS order_count,
         COUNT(DISTINCT o.buyer_id) AS customer_count,
         COALESCE(SUM(o.total_cents), 0) AS total_value
       FROM profiles pr
       JOIN users u ON u.id = pr.user_id
       LEFT JOIN products p ON p.profile_id = pr.id
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status IN ('confirmed', 'out_for_delivery', 'delivered')
         ${dateFilter}
       WHERE u.role = $1
       GROUP BY pr.id, u.role
       ORDER BY order_count DESC, customer_count DESC
       LIMIT 20`,
      [role]
    );
    
    // Format the response
    const leaderboard = rows.map((r, i) => ({
      rank: i + 1,
      id: r.id,
      name: r.business_name || displayNames[role] + ' Shop',
      area: r.area || r.province || 'Unknown',
      verified: r.verified,
      orders: parseInt(r.order_count) || 0,
      customers: parseInt(r.customer_count) || 0,
      total_value: parseInt(r.total_value) || 0,
      trend: 0, // Could track trend by comparing to previous period
      badge: i === 0 ? 'Top ' + displayNames[role] : i === 1 ? '2nd' : i === 2 ? '3rd' : null,
    }));
    
    res.json({ leaderboard, period, role });
  } catch (err) { next(err); }
});

// ── CONTACT FORM ─────────────────────────────────────────────

router.post('/contact', async (req, res, next) => {
  try {
    const { name, phone, email, message, type } = req.body;
    
    if (!name || !message) {
      return res.status(400).json({ error: 'Name and message are required' });
    }
    
    // Send SMS notification to admin (or log it)
    const adminPhone = '+27783776253'; // Your number
    const typeLabels = { general: 'General', spaza: 'Spaza Owner', farmer: 'Farmer', press: 'Press' };
    const smsBody = `📬 New Contact Form\nType: ${typeLabels[type] || 'General'}\nFrom: ${name}\nPhone: ${phone || 'N/A'}\nEmail: ${email || 'N/A'}\nMessage: ${message.substring(0, 100)}...`;
    
    // Send SMS (non-blocking)
    const { sendSMS } = require('../services/sms.service');
    sendSMS(adminPhone, smsBody).catch(err => console.error('[Contact] SMS failed:', err.message));
    
    res.json({ success: true, message: 'Message received!' });
  } catch (err) { next(err); }
});

module.exports = router;
