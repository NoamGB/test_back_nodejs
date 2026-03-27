const { parentPort } = require('worker_threads');
const PDFDocument = require('pdfkit');

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

parentPort.on('message', async (payload) => {
  try {
    const templateName = payload.templateName || 'default-template-v1';
    const data = {
      userId: payload.userId,
      templateName,
      provider: payload.provider || 'n/a',
      generatedAt: new Date().toISOString()
    };
    const doc = new PDFDocument();
    const templateRenderer = getTemplate(templateName);

    doc.on('data', (chunk) => {
      // Transfer chunk from thread to parent process.
      const transferable = Uint8Array.from(chunk);
      parentPort.postMessage({ type: 'chunk', chunk: transferable }, [transferable.buffer]);
    });
    doc.on('end', () => {
      parentPort.postMessage({ type: 'end' });
    });
    doc.on('error', (error) => {
      parentPort.postMessage({ type: 'error', error: error.message });
    });

    templateRenderer(doc, data);
    doc.end();
  } catch (error) {
    parentPort.postMessage({ type: 'error', error: error.message });
  }
});
