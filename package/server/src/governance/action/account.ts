import type { PolicyAction } from "@rezics/contract";
import type { GovernanceActionDefinition } from "./registry";

export const accountPolicyActions = {
  warn: "account.warn",
  silence: "account.silence",
  suspend: "account.suspend",
  ban: "account.ban",
  unblock: "account.unblock",
  rateLimit: "account.rate_limit",
} as const satisfies Record<string, PolicyAction>;

export const accountActionDefinitions = [
  {
    action: accountPolicyActions.warn,
    requiredCapability: "account.warn",
    family: "account",
  },
  {
    action: accountPolicyActions.silence,
    requiredCapability: "account.silence",
    family: "account",
  },
  {
    action: accountPolicyActions.suspend,
    requiredCapability: "account.suspend",
    family: "account",
  },
  {
    action: accountPolicyActions.ban,
    requiredCapability: "account.ban",
    family: "account",
  },
  {
    action: accountPolicyActions.unblock,
    requiredCapability: "account.ban",
    family: "account",
  },
  {
    action: accountPolicyActions.rateLimit,
    requiredCapability: "account.rate_limit",
    family: "account",
  },
] as const satisfies readonly GovernanceActionDefinition[];
