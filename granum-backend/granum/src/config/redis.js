const Redis = require('ioredis');

let redisConfig;

if (process.env.REDIS_URL) {
  redisConfig = { connectionString: process.env.REDIS_URL };
} else if (process.env.REDIS_HOST) {
  redisConfig = {
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'redis_secret',
  };
} else {
  redisConfig = {
    host:     process.env.REDIS_HOST     || 'localhost',
    port:     parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || 'redis_secret',
  };
}

if (process.env.RAILWAY_PRIVATE_DOMAIN) {
  redisConfig.host = process.env.RAILWAY_PRIVATE_DOMAIN;
}

redisConfig.retryStrategy = (times) => Math.min(times * 100, 3000);
redisConfig.maxRetriesPerRequest = 3;

const redis = new Redis(redisConfig);

redis.on('connect',  () => console.log('[Redis] Connected'));
redis.on('error',    (err) => console.error('[Redis] Error:', err.message));
redis.on('reconnecting', () => console.log('[Redis] Reconnecting...'));

module.exports = redis;
