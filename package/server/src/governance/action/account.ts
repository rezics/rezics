import type { PolicyAction } from "@rezics/contract";

export const accountPolicyActions = {
  warn: "account.warn",
  silence: "account.silence",
  suspend: "account.suspend",
  ban: "account.ban",
  unblock: "account.unblock",
  rateLimit: "account.rate_limit",
} as const satisfies Record<string, PolicyAction>;
