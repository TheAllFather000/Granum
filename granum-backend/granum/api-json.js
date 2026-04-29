const express = require('express');
const cors = require('cors');
const { v4: uuid } = require('uuid');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const app = express();
app.use(cors({ 
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'ngrok-skip-browser-warning']
}));
app.use(express.json());

// Explicit preflight handler
app.options('*', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Origin,Accept,ngrok-skip-browser-warning');
  res.sendStatus(204);
});

// TextBee SMS
async function sendSMS(phone, message) {
  // Normalize phone number
  const phoneNorm = phone.replace(/[\s\+]/g, '');
  const phoneZA = phoneNorm.startsWith('27') ? phoneNorm : '27' + phoneNorm.slice(1);
  
  console.log('[SMS] Sending SMS to:', phoneZA);

  const provider = (process.env.SMS_PROVIDER || 'bulksms').toLowerCase();
  if (provider === 'textbee') {
    const apiKey = process.env.TEXTBEE_API_KEY;
    const deviceId = process.env.TEXTBEE_DEVICE_ID;
    if (!apiKey || !deviceId) {
      console.log('[SMS] TextBee not configured (missing TEXTBEE_API_KEY or TEXTBEE_DEVICE_ID)');
    } else {
      try {
        const payload = JSON.stringify({
          recipients: [phoneZA],
          message,
        });

        const result = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: 'api.textbee.dev',
            path: `/api/v1/gateway/devices/${deviceId}/send-sms`,
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'Content-Length': Buffer.byteLength(payload),
            },
          }, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
              try {
                const parsed = JSON.parse(responseBody || '{}');
                if (res.statusCode >= 200 && res.statusCode < 300) {
                  return resolve(parsed);
                }
                reject(new Error(`TextBee HTTP ${res.statusCode}: ${responseBody}`));
              } catch (e) {
                reject(new Error(`TextBee invalid JSON: ${responseBody}`));
              }
            });
          });

          req.on('error', reject);
          req.write(payload);
          req.end();
        });

        console.log('[SMS] TextBee Result:', result);
        return { success: true, provider: 'textbee', result };
      } catch (e) {
        console.log('[SMS] TextBee Error:', e.message);
      }
    }
  }
  
  // Try BulkSMS as backup
  try {
    const res = await fetch('https://api.bulksms.com/v1/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from(process.env.BULKSMS_USERNAME + ':' + process.env.BULKSMS_PASSWORD).toString('base64'),
      },
      body: JSON.stringify([{
        to: phoneZA,
        body: message,
      }]),
    });
    const result = await res.json();
    console.log('[SMS] BulkSMS Result:', result);
    if (result[0]?.id) return { success: true };
  } catch (e) {
    console.log('[SMS] BulkSMS Error:', e.message);
  }
  
  // Fallback - just log
  console.log('[SMS] SIMULATION - would send to', phoneZA, ':', message);
  return { success: true, _simulated: true };
}

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function load(name) {
  const file = path.join(DATA_DIR, name + '.json');
  if (!fs.existsSync(file)) fs.writeFileSync(file, '[]');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function save(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name + '.json'), JSON.stringify(data, null, 2));
}

// Seed data
function seed() {
  let users = load('users');
  if (users.length === 0) {
    const userId = uuid();
    users = [{ id: userId, phone: '0783776253', first_name: 'Ibrahim', role: 'farmer', voucher_balance_cents: 5000 }];
    save('users', users);
    
    const profiles = [{ id: uuid(), user_id: userId, business_name: "Ibrahim's Farm", role: 'farmer', province: 'Gauteng', area: 'Johannesburg' }];
    save('profiles', profiles);
    
    const products = [
      { id: uuid(), profile_id: profiles[0].id, name: 'Fresh Eggs', price_cents: 6500, unit: '30 eggs', emoji: '🥚', category: 'produce', stock_qty: 25 },
      { id: uuid(), profile_id: profiles[0].id, name: 'Whole Chicken', price_cents: 4500, unit: '1.5kg', emoji: '🍗', category: 'meat', stock_qty: 12 },
    ];
    save('products', products);
    
    const vouchers = [
      { id: uuid(), code: 'LH-VOUCHER-42A9F', recipient_phone: '0783776253', initial_cents: 10000, balance_cents: 10000, status: 'active' },
      { id: uuid(), code: 'TEST50', recipient_phone: '0783776253', initial_cents: 5000, balance_cents: 5000, status: 'active' },
    ];
    save('vouchers', vouchers);
  }
}
seed();

// Auth
function normPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('27')) return digits;
  if (digits.startsWith('0')) return '27' + digits.slice(1);
  return '27' + digits;
}

app.post('/auth/otp/request', async (req, res) => {
  const { phone, purpose } = req.body;
  console.log('[OTP] Request:', phone, purpose);
  const phoneNorm = normPhone(phone);
  console.log('[OTP] Normalized:', phoneNorm);
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const users = load('users');
  console.log('[OTP] Users:', users.map(u => u.phone));
  const user = users.find(u => normPhone(u.phone) === phoneNorm);
  console.log('[OTP] Found user:', user);
  
  if (purpose === 'register' && !user) {
    await sendSMS(phone, `Your Granum verification code is: ${otp}`);
  } else if (user) {
    await sendSMS(phone, `Your Granum login code is: ${otp}`);
  } else {
    return res.status(404).json({ error: 'No account found' });
  }
  
  // Store OTP temporarily (in production use Redis)
  const otpStore = load('otp_temp') || [];
  otpStore.push({ phone, otp, created: Date.now() });
  save('otp_temp', otpStore.slice(-100)); // Keep last 100
  
  res.json({ message: 'OTP sent', _otp: otp }); // Remove _otp in production
});

app.post('/auth/register', (req, res) => {
  const { phone, first_name, role } = req.body;
  const users = load('users');
  const existing = users.find(u => u.phone === phone);
  if (existing) return res.json({ user: existing, tokens: { accessToken: 'demo' } });
  
  const user = { id: uuid(), phone, first_name, role, voucher_balance_cents: 0 };
  users.push(user);
  save('users', users);
  
  const profile = { id: uuid(), user_id: user.id, business_name: first_name + "'s Shop", role, province: '', area: '' };
  const profiles = load('profiles');
  profiles.push(profile);
  save('profiles', profiles);
  
  res.json({ user, tokens: { accessToken: 'demo' } });
});

app.post('/auth/login', (req, res) => {
  const { phone } = req.body;
  const users = load('users');
  const user = users.find(u => u.phone === phone);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user, tokens: { accessToken: 'demo' } });
});

// Profiles
app.get('/fsm/profiles', (req, res) => {
  res.json({ profiles: load('profiles') });
});

app.get('/fsm/profiles/me', (req, res) => {
  const users = load('users');
  const profiles = load('profiles');
  const user = users[0]; // Simulated
  const profile = profiles.find(p => p.user_id === user?.id);
  res.json({ ...profile, ...user });
});

app.patch('/fsm/profiles/:id', (req, res) => {
  const { id } = req.params;
  const profiles = load('profiles');
  const idx = profiles.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  profiles[idx] = { ...profiles[idx], ...req.body };
  save('profiles', profiles);
  res.json({ profile: profiles[idx] });
});

// Products
app.get('/fsm/products', (req, res) => {
  const products = load('products');
  const profiles = load('profiles');
  const data = products.map(p => ({
    ...p,
    business_name: profiles.find(pr => pr.id === p.profile_id)?.business_name || 'Unknown'
  }));
  res.json({ products: data });
});

app.post('/fsm/products', (req, res) => {
  const products = load('products');
  const product = { id: uuid(), ...req.body };
  products.push(product);
  save('products', products);
  res.json({ product });
});

app.patch('/fsm/products/:id', (req, res) => {
  const { id } = req.params;
  const products = load('products');
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  products[idx] = { ...products[idx], ...req.body };
  save('products', products);
  res.json({ product: products[idx] });
});

app.delete('/fsm/products/:id', (req, res) => {
  const { id } = req.params;
  const products = load('products');
  const idx = products.findIndex(p => p.id === id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  products.splice(idx, 1);
  save('products', products);
  res.json({ message: 'Deleted' });
});

// Vouchers
// Get all vouchers
app.get('/fsm/vouchers', (req, res) => {
  res.json({ vouchers: load('vouchers') });
});

app.get('/fsm/vouchers/:code', (req, res) => {
  const { code } = req.params;
  const vouchers = load('vouchers');
  const voucher = vouchers.find(v => v.code === code.toUpperCase());
  if (!voucher) return res.status(404).json({ error: 'Not found' });
  res.json({ voucher });
});

// POST /fsm/vouchers - create voucher
app.post('/fsm/vouchers', (req, res) => {
  const { recipient_phone, initial_cents, sender_name, message } = req.body;
  const vouchers = load('vouchers');
  const code = 'LH-' + Math.random().toString(36).toUpperCase().slice(2, 7);
  const voucher = {
    id: uuid(),
    code,
    recipient_phone,
    sender_name,
    message,
    initial_cents: initial_cents || 5000,
    balance_cents: initial_cents || 5000,
    status: 'active',
    created_at: new Date().toISOString()
  };
  vouchers.push(voucher);
  save('vouchers', vouchers);
  res.json({ voucher });
});

app.get('/fsm/voucher-balance', (req, res) => {
  const users = load('users');
  const user = users[0]; // Simulated
  res.json({ voucher_balance_cents: user?.voucher_balance_cents || 0 });
});

app.post('/fsm/voucher-balance/use', (req, res) => {
  const { amount_cents } = req.body;
  const users = load('users');
  const user = users[0];
  if (user.voucher_balance_cents < amount_cents) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  user.voucher_balance_cents -= amount_cents;
  save('users', users);
  res.json({ success: true });
});

// Orders
app.post('/fsm/orders', (req, res) => {
  const orders = load('orders');
  const order = { id: uuid(), order_number: 'LH-' + Date.now().toString(36).toUpperCase(), ...req.body };
  orders.push(order);
  save('orders', orders);
  res.json({ order });
});

app.get('/fsm/orders', (req, res) => {
  res.json({ orders: load('orders') });
});

app.patch('/fsm/orders/:id/cancel', (req, res) => {
  const { id } = req.params;
  const orders = load('orders');
  const idx = orders.findIndex(o => o.id === id);
  if (idx !== -1) {
    orders[idx].status = 'cancelled';
    save('orders', orders);
  }
  res.json({ success: true });
});

// === RESCUE ===
// GET rescue/requests
app.get('/fsm/rescue/requests', (req, res) => {
  const requests = load('rescue_requests');
  const status = req.query.status;
  let filtered = requests;
  if (status && status !== 'all') {
    filtered = requests.filter(r => r.status === status);
  }
  res.json({ requests: filtered });
});

// POST rescue/requests
app.post('/fsm/rescue/requests', (req, res) => {
  const requests = load('rescue_requests');
  const request = {
    id: uuid(),
    ...req.body,
    status: 'active',
    created_at: new Date().toISOString()
  };
  requests.push(request);
  save('rescue_requests', requests);
  res.json({ request });
});

// GET rescue/offers
app.get('/fsm/rescue/offers', (req, res) => {
  const offers = load('rescue_offers');
  const status = req.query.status;
  let filtered = offers;
  if (status && status !== 'all') {
    filtered = offers.filter(o => o.status === status);
  }
  res.json({ offers: filtered });
});

// POST rescue/offers
app.post('/fsm/rescue/offers', (req, res) => {
  const offers = load('rescue_offers');
  const offer = {
    id: uuid(),
    ...req.body,
    status: 'active',
    created_at: new Date().toISOString()
  };
  offers.push(offer);
  save('rescue_offers', offers);
  res.json({ offer });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API running on port ${PORT}`));