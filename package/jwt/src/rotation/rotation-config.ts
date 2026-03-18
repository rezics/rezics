export const DEFAULT_ROTATION_INTERVAL_MS = 90 * 24 * 60 * 60 * 1000;
export const DEFAULT_CHECK_INTERVAL_MS = 60 * 1000;

export type JwtRotationConfigInput = {
  tokenTtlMs: number;
  rotationIntervalMs?: number;
  checkIntervalMs?: number;
  gracePeriodMs?: number;
};

export type JwtRotationConfig = {
  tokenTtlMs: number;
  rotationIntervalMs: number;
  checkIntervalMs: number;
  gracePeriodMs: number;
};

export function resolveRotationConfig(
  input: JwtRotationConfigInput,
): JwtRotationConfig {
  return {
    tokenTtlMs: input.tokenTtlMs,
    rotationIntervalMs:
      input.rotationIntervalMs ?? DEFAULT_ROTATION_INTERVAL_MS,
    checkIntervalMs: input.checkIntervalMs ?? DEFAULT_CHECK_INTERVAL_MS,
    gracePeriodMs: input.gracePeriodMs ?? input.tokenTtlMs * 2,
  };
}
