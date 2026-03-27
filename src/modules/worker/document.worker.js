require('dotenv').config();

const documentQueue = require('../queues/document.queue');
const { connectDB, mongoose } = require('../../config/database');
const { processDocumentJob } = require('../services/document.processor');
const { queueSizeGauge } = require('../../config/metrics');
const logger = require('../../config/logger');

const concurrency = Number(process.env.QUEUE_CONCURRENCY || 10);

const startWorker = async () => {
  await connectDB();

  documentQueue.on('error', (error) => {
    logger.error({ message: 'Queue error', error: error.message });
  });

  documentQueue.process(concurrency, async (job) => {
    await processDocumentJob({ ...job.data, source: 'queue' });
    const counts = await documentQueue.getJobCounts().catch(() => ({ waiting: 0, active: 0 }));
    queueSizeGauge.set((counts.waiting || 0) + (counts.active || 0));
    return true;
  });

  logger.info({ message: 'Worker started', concurrency });
};

const shutdown = async (signal) => {
  logger.info({ message: 'Worker graceful shutdown started', signal });
  await documentQueue.close().catch(() => undefined);
  await mongoose.connection.close().catch(() => undefined);
  logger.info({ message: 'Worker graceful shutdown finished' });
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startWorker().catch((error) => {
  logger.error({ message: 'Worker bootstrap failed', error: error.message });
  process.exit(1);
});