import {describe, expect, test} from 'bun:test';
import {createRefreshRetryPolicy} from './refreshRetryPolicy';

describe('createRefreshRetryPolicy', () => {
  test('uses exponential backoff before entering cooldown', () => {
    const policy = createRefreshRetryPolicy({
      maxImmediateRetries: 3,
      initialDelayMs: 500,
      maxDelayMs: 10_000,
      cooldownDelayMs: 30_000,
    });

    expect(policy.registerFailure()).toBe(500);
    expect(policy.registerFailure()).toBe(1_000);
    expect(policy.registerFailure()).toBe(2_000);
    expect(policy.registerFailure()).toBe(30_000);
    expect(policy.registerFailure()).toBe(30_000);
  });

  test('resets the failure window after a successful refresh', () => {
    const policy = createRefreshRetryPolicy({
      initialDelayMs: 750,
      cooldownDelayMs: 20_000,
    });

    expect(policy.registerFailure()).toBe(750);
    expect(policy.registerFailure()).toBe(1_500);

    policy.reset();

    expect(policy.registerFailure()).toBe(750);
  });
});
