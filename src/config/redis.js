const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableReadyCheck: false
});

const isRedisReady = () => redis.status === 'ready';

module.exports = { redis, isRedisReady };