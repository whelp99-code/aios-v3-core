const test = require('node:test');
const assert = require('node:assert');
const { withRetry, defaultIsRetryable } = require('../packages/ai-core/dist/retry');

test('withRetry succeeds on first try', async () => {
  let calls = 0;
  const result = await withRetry(async () => {
    calls++;
    return 'ok';
  });
  assert.strictEqual(result, 'ok');
  assert.strictEqual(calls, 1);
});

test('withRetry retries on 429 then succeeds', async () => {
  let calls = 0;
  const result = await withRetry(
    async () => {
      calls++;
      if (calls < 3) {
        const err = new Error('rate limited');
        err.response = { status: 429 };
        throw err;
      }
      return 'recovered';
    },
    { baseDelayMs: 1, maxDelayMs: 5 }
  );
  assert.strictEqual(result, 'recovered');
  assert.strictEqual(calls, 3);
});

test('withRetry does not retry on 400', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        const err = new Error('bad request');
        err.response = { status: 400 };
        throw err;
      },
      { baseDelayMs: 1 }
    )
  );
  assert.strictEqual(calls, 1);
});

test('withRetry stops after max retries', async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(
      async () => {
        calls++;
        const err = new Error('server error');
        err.response = { status: 503 };
        throw err;
      },
      { retries: 2, baseDelayMs: 1, maxDelayMs: 3 }
    )
  );
  assert.strictEqual(calls, 3); // initial + 2 retries
});

test('defaultIsRetryable classifies errors', () => {
  assert.strictEqual(defaultIsRetryable({ response: { status: 429 } }), true);
  assert.strictEqual(defaultIsRetryable({ response: { status: 500 } }), true);
  assert.strictEqual(defaultIsRetryable({ response: { status: 404 } }), false);
  assert.strictEqual(defaultIsRetryable({ code: 'ECONNRESET' }), true);
  assert.strictEqual(defaultIsRetryable({ code: 'NOPE' }), false);
});
