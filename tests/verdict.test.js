const test = require('node:test');
const assert = require('node:assert');
const { parseCriticVerdict } = require('../packages/orchestrator/dist/verdict');

test('detects NEEDS_CORRECTION verdict', () => {
  const v = parseCriticVerdict('VERDICT: NEEDS_CORRECTION\nThe code has a bug.');
  assert.strictEqual(v.needsCorrection, true);
  assert.strictEqual(v.needsApproval, false);
});

test('detects NEEDS_APPROVAL verdict', () => {
  const v = parseCriticVerdict('Looks risky. VERDICT: NEEDS_APPROVAL');
  assert.strictEqual(v.needsApproval, true);
});

test('case-insensitive and spaced variants', () => {
  assert.strictEqual(parseCriticVerdict('needs correction please').needsCorrection, true);
  assert.strictEqual(parseCriticVerdict('Needs Approval').needsApproval, true);
});

test('approved review needs neither', () => {
  const v = parseCriticVerdict('VERDICT: APPROVED\nGreat work.');
  assert.strictEqual(v.needsCorrection, false);
  assert.strictEqual(v.needsApproval, false);
});

test('handles empty/undefined input', () => {
  assert.deepStrictEqual(parseCriticVerdict(''), {
    needsCorrection: false,
    needsApproval: false,
  });
  assert.deepStrictEqual(parseCriticVerdict(undefined), {
    needsCorrection: false,
    needsApproval: false,
  });
});
