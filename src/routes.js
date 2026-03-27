const express = require('express');
const { createBatchController, getBatchStatus,  getDocument} = require('./modules/controllers/document.controller');

const { getHealth } = require('./modules/controllers/health.controller');
const { getDashboardText } = require('./modules/controllers/dashboard.controller');
const { metricsRegistry } = require('./config/metrics');
const {  createBatchSchema,  validateBody, validateParamObjectId} = require('./modules/validation/document.validation');

const router = express.Router();

router.post('/api/documents/batch', validateBody(createBatchSchema), createBatchController);
router.get('/api/documents/batch/:batchId', validateParamObjectId('batchId'), getBatchStatus);
router.get('/api/documents/:documentId', validateParamObjectId('documentId'), getDocument);

router.get('/health', getHealth);
router.get('/dashboard', getDashboardText);
router.get('/metrics', async (req, res) => {
  res.set('Content-Type', metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

module.exports = router;