const Queue = require('bull');
require('dotenv').config();

const redisUrl = process.env.REDIS_URL;
const redisOptions = {
  maxRetriesPerRequest: 1,
  enableReadyCheck: false
};

if (redisUrl) {
  const parsedUrl = new URL(redisUrl);
  redisOptions.host = parsedUrl.hostname;
  redisOptions.port = Number(parsedUrl.port || 6379);
  if (parsedUrl.password) redisOptions.password = parsedUrl.password;
} else {
  redisOptions.host = process.env.REDIS_HOST || '127.0.0.1';
  redisOptions.port = Number(process.env.REDIS_PORT || 6379);
}

const documentQueue = new Queue('documents', {
  redis: redisOptions
});

module.exports = documentQueue;