const { userIds } = require('./src/data/batch.seed');
const fs = require('fs/promises');
const path = require('path');

const API_BASE_URL = process.env.BENCHMARK_API_URL || `http://localhost:${process.env.PORT || 3000}`;
const POLL_INTERVAL_MS = Number(process.env.BENCHMARK_POLL_MS || 1000);
const MAX_WAIT_MS = Number(process.env.BENCHMARK_MAX_WAIT_MS || 10 * 60 * 1000);
const REPORT_FILE = process.env.BENCHMARK_REPORT_FILE || 'benchmark-report.json';
const CURVE_FILE = process.env.BENCHMARK_CURVE_FILE || 'benchmark-curve.csv';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const text = await response.text();
  let parsedBody = {};

  try {
    parsedBody = text ? JSON.parse(text) : {};
  } catch (error) {
    parsedBody = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} on ${url}: ${JSON.stringify(parsedBody)}`);
  }

  return parsedBody;
};

const pollDocumentsUntilDone = async (batchId, totalDocuments) => {
  const pollStartedAt = Date.now();
  let lastCounts = {};

  while (Date.now() - pollStartedAt < MAX_WAIT_MS) {
    const result = await fetchJson(`${API_BASE_URL}/api/documents/batch/${batchId}`);
    lastCounts = result.statusCounts || {};
    const completed = lastCounts.completed || 0;
    const failed = lastCounts.failed || 0;
    const done = completed + failed;

    process.stdout.write(
      `\rProgress: ${done}/${totalDocuments} (completed=${completed}, failed=${failed}, pending=${totalDocuments - done})`
    );

    if (done >= totalDocuments) {
      process.stdout.write('\n');
      return { counts: lastCounts, timedOut: false };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  process.stdout.write('\n');
  return { counts: lastCounts, timedOut: true };
};

const formatMb = (bytes) => Number((bytes / 1024 / 1024).toFixed(2));

const buildCurveCsv = (samples) => {
  const header = 'timestamp,elapsedSeconds,cpuPercent,memoryRssMb,memoryHeapUsedMb,completed,failed,pending\n';
  const rows = samples.map((sample) =>
    [
      sample.timestamp,
      sample.elapsedSeconds,
      sample.cpuPercent,
      sample.memory.rssMb,
      sample.memory.heapUsedMb,
      sample.progress.completed,
      sample.progress.failed,
      sample.progress.pending
    ].join(',')
  );
  return `${header}${rows.join('\n')}\n`;
};

const runBenchmark = async () => {
  const startedAt = Date.now();
  let previousCpuUsage = process.cpuUsage();
  let previousCpuSampleTime = startedAt;
  const curveSamples = [];

  console.log(`Starting benchmark against: ${API_BASE_URL}`);
  console.log(`Submitting batch with ${userIds.length} users...`);

  const createBatchResponse = await fetchJson(`${API_BASE_URL}/api/documents/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds })
  });

  const batchId = createBatchResponse.batchId;
  if (!batchId) {
    throw new Error('No batchId returned by API.');
  }

  console.log(`Batch created: ${batchId}`);

  const batchResponse = await fetchJson(`${API_BASE_URL}/api/documents/batch/${batchId}`);
  const documentIds = batchResponse?.data?.documents || [];
  if (!Array.isArray(documentIds) || documentIds.length === 0) {
    throw new Error('No document IDs found on batch.');
  }

  console.log(`Batch contains ${documentIds.length} documents.`);
  console.log('Polling document statuses...');

  const pollStartedAt = Date.now();
  let pollingDone = false;
  const pollingPromise = pollDocumentsUntilDone(batchId, documentIds.length).then((value) => {
    pollingDone = true;
    return value;
  });

  while (true) {
    await sleep(1000);
    const elapsed = Date.now() - startedAt;
    const now = Date.now();
    const currentCpu = process.cpuUsage();
    const cpuDiff = process.cpuUsage(previousCpuUsage);
    const timeDiffMicros = (now - previousCpuSampleTime) * 1000;
    const cpuPercent = timeDiffMicros > 0 ? Number((((cpuDiff.user + cpuDiff.system) / timeDiffMicros) * 100).toFixed(2)) : 0;
    previousCpuUsage = currentCpu;
    previousCpuSampleTime = now;

    const mem = process.memoryUsage();
    let progress = { completed: 0, failed: 0, pending: documentIds.length };
    try {
      const batchSnapshot = await fetchJson(`${API_BASE_URL}/api/documents/batch/${batchId}`);
      const counts = batchSnapshot?.statusCounts || {};
      progress.completed = counts.completed || 0;
      progress.failed = counts.failed || 0;
      progress.pending = Math.max(0, documentIds.length - progress.completed - progress.failed);
    } catch (error) {
      progress = { completed: 0, failed: 0, pending: documentIds.length };
    }

    curveSamples.push({
      timestamp: new Date(now).toISOString(),
      elapsedSeconds: Number((elapsed / 1000).toFixed(2)),
      cpuPercent,
      memory: {
        rssMb: formatMb(mem.rss),
        heapUsedMb: formatMb(mem.heapUsed)
      },
      progress
    });

    if ((now - pollStartedAt) > MAX_WAIT_MS || pollingDone) break;
  }

  const { counts, timedOut } = await pollingPromise;
  const endedAt = Date.now();
  const elapsedMs = endedAt - startedAt;
  const elapsedSeconds = elapsedMs / 1000;
  const processed = (counts.completed || 0) + (counts.failed || 0);
  const docsPerSecond = elapsedSeconds > 0 ? processed / elapsedSeconds : 0;

  const report = {
    apiBaseUrl: API_BASE_URL,
    batchId,
    totalDocuments: documentIds.length,
    processedDocuments: processed,
    counts,
    timedOut,
    elapsedMs,
    elapsedSeconds: Number(elapsedSeconds.toFixed(2)),
    documentsPerSecond: Number(docsPerSecond.toFixed(2)),
    cpuAndMemorySamples: curveSamples,
    startedAt: new Date(startedAt).toISOString(),
    endedAt: new Date(endedAt).toISOString()
  };

  console.log('\nBenchmark report:');
  console.table({
    totalDocuments: report.totalDocuments,
    processedDocuments: report.processedDocuments,
    elapsedSeconds: report.elapsedSeconds,
    documentsPerSecond: report.documentsPerSecond,
    timedOut: report.timedOut
  });
  console.log('Status counts:', report.counts);
  await fs.mkdir(path.dirname(CURVE_FILE), { recursive: true }).catch(() => undefined);
  await fs.writeFile(CURVE_FILE, buildCurveCsv(curveSamples), 'utf-8');
  await fs.writeFile(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  console.log(`Report saved to: ${REPORT_FILE}`);
  console.log(`Curve data saved to: ${CURVE_FILE}`);
  console.log('\nRaw report JSON:');
  console.log(JSON.stringify(report, null, 2));
};

runBenchmark().catch((error) => {
  console.error('\nBenchmark failed:', error.message);
  process.exit(1);
});
