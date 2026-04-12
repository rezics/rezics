import type { NormalizedTokenName as NormalizedTokenNameType } from "@rezics/contract";

export type TokenRefreshFn = () => Promise<{ token: string }>;

export type TokenRefreshRegistry = Partial<
  Record<NormalizedTokenNameType, TokenRefreshFn>
>;

export function createTokenRefreshRegistry(
  overrides?: TokenRefreshRegistry,
): TokenRefreshRegistry {
  return overrides ? { ...overrides } : {};
}
