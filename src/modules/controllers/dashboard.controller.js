const fs = require('fs/promises');
const path = require('path');
const { isDbConnected } = require('../../config/database');
const { redis } = require('../../config/redis');
const documentQueue = require('../queues/document.queue');

const getDashboardText = async (req, res) => {
  const now = new Date().toISOString();
  const db = isDbConnected() ? 'up' : 'down';
  const redisStatus = redis.status || 'unknown';

  let counts = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
  try {
    counts = await documentQueue.getJobCounts();
  } catch (error) {
    counts = { waiting: -1, active: -1, completed: -1, failed: -1, delayed: -1 };
  }

  let latestBenchmark = 'No benchmark report found';
  const reportPath = path.resolve(process.cwd(), process.env.BENCHMARK_REPORT_FILE || 'benchmark-report.json');
  try {
    const reportRaw = await fs.readFile(reportPath, 'utf-8');
    const report = JSON.parse(reportRaw);
    latestBenchmark = [
      `batchId=${report.batchId}`,
      `elapsedSeconds=${report.elapsedSeconds}`,
      `documentsPerSecond=${report.documentsPerSecond}`,
      `processed=${report.processedDocuments}/${report.totalDocuments}`
    ].join(' | ');
  } catch (error) {
    // Keep default message.
  }

  const lines = [
    'Document Service Dashboard',
    `timestamp: ${now}`,
    '',
    '[Health]',
    `db: ${db}`,
    `redis: ${redisStatus}`,
    '',
    '[Queue]',
    `waiting: ${counts.waiting ?? 0}`,
    `active: ${counts.active ?? 0}`,
    `delayed: ${counts.delayed ?? 0}`,
    `completed: ${counts.completed ?? 0}`,
    `failed: ${counts.failed ?? 0}`,
    '',
    '[Last Benchmark]',
    latestBenchmark,
    ''
  ];

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(200).send(lines.join('\n'));
};

module.exports = { getDashboardText };
