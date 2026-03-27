const DocumentModel = require('../models/document.model');
const BatchModel = require('../models/batch.model');
const { generatePDFStreamWithWorkerThread } = require('../generator-pdf/pdf.generator');
const { uploadPdfStream } = require('../storage/pdf.storage');
const { callDocuSign } = require('./docusign.service');
const {
  documentsGeneratedTotal,
  batchProcessingDurationSeconds
} = require('../../config/metrics');
const logger = require('../../config/logger');

const PDF_TIMEOUT_MS = Number(process.env.PDF_TIMEOUT_MS || 5000);

const withTimeout = (promise, timeoutMs) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`PDF generation timeout after ${timeoutMs}ms`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const updateBatchStatus = async (batchId) => {
  const documents = await DocumentModel.find({ batchId }, { status: 1 }).lean();
  if (documents.length === 0) return;

  const hasPending = documents.some((doc) => doc.status === 'pending' || doc.status === 'processing');
  const hasFailed = documents.some((doc) => doc.status === 'failed');
  const completedCount = documents.filter((doc) => doc.status === 'completed').length;

  let status = 'processing';
  if (!hasPending && hasFailed && completedCount === 0) status = 'failed';
  if (!hasPending && completedCount === documents.length) status = 'completed';
  if (!hasPending && hasFailed && completedCount > 0) status = 'failed';

  const update = { status };
  if (status === 'processing') update.startedAt = new Date();
  if (status === 'completed' || status === 'failed') update.completedAt = new Date();

  const batch = await BatchModel.findByIdAndUpdate(batchId, update, { returnDocument: 'after' });
  if (batch?.startedAt && batch?.completedAt) {
    const durationSec = (new Date(batch.completedAt).getTime() - new Date(batch.startedAt).getTime()) / 1000;
    if (durationSec >= 0) batchProcessingDurationSeconds.observe(durationSec);
  }
};

const processDocumentJob = async ({ documentId, userId, batchId, source = 'queue' }) => {
  const correlation = { documentId: String(documentId), userId, batchId: String(batchId), source };
  logger.info({ message: 'Document processing started', ...correlation });

  await DocumentModel.findByIdAndUpdate(documentId, { status: 'processing', error: null });
  await BatchModel.findByIdAndUpdate(batchId, { status: 'processing', startedAt: new Date() });

  try {
    const docusign = await callDocuSign({ userId });
    const pdfStream = await withTimeout(
      generatePDFStreamWithWorkerThread({
        userId,
        templateName: 'default-template-v1',
        provider: docusign.provider
      }),
      PDF_TIMEOUT_MS
    );

    const fileId = await withTimeout(
      uploadPdfStream(pdfStream, `document-${documentId}.pdf`, {
        userId,
        batchId
      }),
      PDF_TIMEOUT_MS
    );

    await DocumentModel.findByIdAndUpdate(documentId, {
      status: 'completed',
      fileId
    });
    documentsGeneratedTotal.inc();
    logger.info({ message: 'Document processing completed', ...correlation, fileId });
  } catch (error) {
    await DocumentModel.findByIdAndUpdate(documentId, {
      status: 'failed',
      error: error.message
    });
    logger.error({ message: 'Document processing failed', ...correlation, error: error.message });
    throw error;
  } finally {
    await updateBatchStatus(batchId);
  }
};

module.exports = { processDocumentJob, updateBatchStatus };
