export type RefreshRetryPolicyOptions = {
  maxImmediateRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  cooldownDelayMs?: number;
};

export type RefreshRetryPolicy = {
  reset(): void;
  registerFailure(): number;
};

const DEFAULT_OPTIONS = {
  maxImmediateRetries: 3,
  initialDelayMs: 1_000,
  maxDelayMs: 15_000,
  cooldownDelayMs: 60_000,
} satisfies Required<RefreshRetryPolicyOptions>;

export function createRefreshRetryPolicy(
  options: RefreshRetryPolicyOptions = {},
): RefreshRetryPolicy {
  const config = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  let consecutiveFailures = 0;

  return {
    reset() {
      consecutiveFailures = 0;
    },
    registerFailure() {
      consecutiveFailures += 1;

      if (consecutiveFailures > config.maxImmediateRetries) {
        return config.cooldownDelayMs;
      }

      const exponentialDelay =
        config.initialDelayMs * 2 ** (consecutiveFailures - 1);

      return Math.min(exponentialDelay, config.maxDelayMs);
    },
  };
}
