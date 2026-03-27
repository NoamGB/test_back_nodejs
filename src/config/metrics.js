const client = require('prom-client');

client.collectDefaultMetrics();

const documentsGeneratedTotal = new client.Counter({
  name: 'documents_generated_total',
  help: 'Total number of generated documents'
});

const batchProcessingDurationSeconds = new client.Histogram({
  name: 'batch_processing_duration_seconds',
  help: 'Batch processing duration in seconds',
  buckets: [1, 5, 10, 30, 60, 120, 300, 600]
});

const queueSizeGauge = new client.Gauge({
  name: 'queue_size',
  help: 'Current queue size'
});

module.exports = {
  metricsRegistry: client.register,
  documentsGeneratedTotal,
  batchProcessingDurationSeconds,
  queueSizeGauge
};
