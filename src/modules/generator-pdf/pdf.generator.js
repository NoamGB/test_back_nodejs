const path = require('path');
const { Worker } = require('worker_threads');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');

const templateCache = new Map();

const getTemplate = (templateName) => {
  if (!templateCache.has(templateName)) {
    templateCache.set(templateName, (doc, data) => {
      doc.fontSize(18).text('Generated Document', { underline: true });
      doc.moveDown();
      doc.fontSize(12).text(`Template: ${templateName}`);
      doc.text(`User ID: ${data.userId}`);
      doc.text(`Generated At: ${data.generatedAt}`);
      doc.text(`Provider: ${data.provider}`);
    });
  }
  return templateCache.get(templateName);
};

const preparePdfDataWithWorkerThread = (payload) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pdf.thread.js'));
    worker.once('message', (message) => {
      worker.terminate();
      if (!message?.ok) {
        reject(new Error(message?.error || 'PDF generation failed'));
        return;
      }
      resolve(message.data);
    });
    worker.once('error', reject);
    worker.postMessage(payload);
  });

const generatePDFStream = (templateData) => {
  const doc = new PDFDocument();
  const stream = new PassThrough();
  const templateRenderer = getTemplate(templateData.templateName || 'default-template-v1');
  doc.pipe(stream);
  templateRenderer(doc, templateData);
  doc.end();
  return stream;
};

module.exports = { preparePdfDataWithWorkerThread, generatePDFStream };