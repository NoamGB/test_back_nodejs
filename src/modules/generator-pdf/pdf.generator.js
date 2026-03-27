const path = require('path');
const { Worker } = require('worker_threads');
const { PassThrough } = require('stream');

const generatePDFStreamWithWorkerThread = (payload) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'pdf.thread.js'));
    const stream = new PassThrough();
    const cleanup = () => worker.terminate().catch(() => undefined);

    worker.on('message', (message) => {
      if (message?.type === 'chunk' && message.chunk) {
        stream.write(Buffer.from(message.chunk));
        return;
      }
      if (message?.type === 'end') {
        stream.end();
        cleanup();
        return;
      }
      if (message?.type === 'error') {
        stream.destroy(new Error(message.error || 'PDF generation failed'));
        cleanup();
      }
    });
    worker.once('error', (error) => {
      stream.destroy(error);
      cleanup();
    });
    worker.once('exit', (code) => {
      if (code !== 0 && !stream.destroyed && !stream.readableEnded) {
        stream.destroy(new Error(`PDF worker exited with code ${code}`));
      }
    });
    worker.postMessage(payload);
    resolve(stream);
  });

module.exports = { generatePDFStreamWithWorkerThread };