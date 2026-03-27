const { parentPort } = require('worker_threads');
parentPort.on('message', async (payload) => {
  try {
    const result = {
      userId: payload.userId,
      templateName: payload.templateName || 'default-template-v1',
      provider: payload.provider || 'n/a',
      generatedAt: new Date().toISOString()
    };
    parentPort.postMessage({ ok: true, data: result });
  } catch (error) {
    parentPort.postMessage({ ok: false, error: error.message });
  }
});
