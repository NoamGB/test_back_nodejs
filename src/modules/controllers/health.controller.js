const { isDbConnected } = require('../../config/database');
const { redis, isRedisReady } = require('../../config/redis');
const documentQueue = require('../queues/document.queue');

const getHealth = async (req, res) => {
  let queueSize = 0;
  try {
    const counts = await documentQueue.getJobCounts();
    queueSize = (counts.waiting || 0) + (counts.active || 0) + (counts.delayed || 0);
  } catch (error) {
    queueSize = -1;
  }

  const redisConnected = isRedisReady() || redis.status === 'connecting';
  const dbConnected = isDbConnected();
  const healthy = dbConnected && redisConnected;

  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    checks: {
      db: dbConnected ? 'up' : 'down',
      redis: redisConnected ? redis.status : 'down',
      queue: queueSize >= 0 ? 'up' : 'down'
    },
    queueSize
  });
};

module.exports = { getHealth };
