require('dotenv').config();

const express    = require('express');
const helmet     = require('helmet');
const cors       = require('cors');
const compression= require('compression');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const apiRoutes  = require('./routes/api.routes');
const { errorHandler, notFound } = require('./middleware/error.middleware');
const { pool }   = require('./config/db');
require('./config/redis'); // connect on startup

const app  = express();
const PORT = process.env.API_PORT || 3000;

// ── Security headers ───────────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
const corsOptions = {
  origin: corsOrigins.includes('*') ? true : corsOrigins.length > 0 ? corsOrigins : ['http://localhost:5500', 'http://127.0.0.1:5500'],
  methods:     ['GET','POST','PATCH','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Cache-Control','Pragma','ngrok-skip-browser-warning'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors());

// ── Body parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Logging ────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Global rate limit ──────────────────────────────────────────
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
}));

// ── Trust proxy (needed if behind nginx / Docker) ──────────────
app.set('trust proxy', 1);

// ── Health check ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({
      status:  'ok',
      service: 'granum-api',
      version: require('../package.json').version,
      env:     process.env.NODE_ENV,
      db:      'connected',
    });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── Routes ─────────────────────────────────────────────────────
app.use('/auth', authRoutes);
app.use('/fsm',  apiRoutes);
app.use('/api',  apiRoutes); // alias for /fsm

// ── 404 + error handler ────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ──────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌱 Granum API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Env:    ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
