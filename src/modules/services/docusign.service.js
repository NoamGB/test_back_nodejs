const CircuitBreaker = require('opossum');

const simulateDocuSignCall = async ({ userId }) => {
  const latency = 50 + Math.floor(Math.random() * 250);
  await new Promise((resolve) => setTimeout(resolve, latency));

  // Simulate occasional transient failures.
  if (Math.random() < 0.05) {
    throw new Error(`DocuSign temporary failure for user ${userId}`);
  }

  return { ok: true, provider: 'docusign-simulated', latencyMs: latency };
};

const circuitBreaker = new CircuitBreaker(simulateDocuSignCall, {
  timeout: 1000,
  errorThresholdPercentage: 50,
  resetTimeout: 5000
});

const callDocuSign = (payload) => circuitBreaker.fire(payload);

module.exports = { callDocuSign, circuitBreaker };
