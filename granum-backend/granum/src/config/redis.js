const Redis = require('ioredis');

const redis = new Redis({
  host:     process.env.REDIS_HOST     || 'localhost',
  port:     parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'redis_secret',
  retryStrategy: (times) => Math.min(times * 100, 3000),
  maxRetriesPerRequest: 3,
});

redis.on('connect',  () => console.log('[Redis] Connected'));
redis.on('error',    (err) => console.error('[Redis] Error:', err.message));
redis.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

module.exports = redis;
