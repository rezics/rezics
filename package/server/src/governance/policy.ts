import type {
  Capability,
  DecisionCode,
  PolicyDecision,
  PolicyInput,
} from "@rezics/contract";

const actionCapabilityMap: Partial<Record<PolicyInput["action"], Capability>> =
  {
    "account.warn": "account.warn",
    "account.silence": "account.silence",
    "account.suspend": "account.suspend",
    "account.ban": "account.ban",
    "account.rate_limit": "account.rate_limit",
    "case.triage": "moderation.case.triage",
    "case.assign": "moderation.case.assign",
    "case.decide": "moderation.case.decide",
    "case.escalate": "moderation.case.escalate",
    "case.reverse": "moderation.case.reverse",
    "queue.site.decide": "queue.site.decide",
    "queue.realm.decide": "queue.realm.decide",
    "content.delete": "content.takedown",
    "content.takedown": "content.takedown",
    "content.lock": "content.lock",
    "content.archive": "content.archive",
    "content.restore": "content.restore",
    "tag.curate": "tag.curate",
    "audit.read": "audit.read",
  };

function decision(
  allowed: boolean,
  code: DecisionCode,
  reason: string,
): PolicyDecision {
  return {
    allowed,
    code,
    reason,
    safeMessage: allowed
      ? "Allowed"
      : "You do not have permission to perform this action.",
    auditCode: code,
  };
}

function capabilityMatches(input: PolicyInput, required: Capability) {
  const allCapabilities = [
    ...input.capabilities,
    ...(input.realmMembership?.capabilities ?? []),
  ];

  return allCapabilities.some((grant) => {
    if (grant.capability !== required) return false;
    if (grant.scope.kind === "global") return true;
    const targetRealmId =
      input.target?.realmUnitId ?? input.realmMembership?.realmUnitId ?? null;
    return grant.scope.realmUnitId === targetRealmId;
  });
}

export function decide(input: PolicyInput): PolicyDecision {
  if (input.activeEnforcement?.activeKinds.includes("ban")) {
    return decision(false, "BLOCKED_ACCOUNT", "active ban enforcement");
  }

  if (
    input.activeEnforcement?.activeKinds.some((kind) =>
      ["silence", "suspension", "rate_limit", "trust_restriction"].includes(
        kind,
      ),
    ) &&
    input.action.startsWith("content.")
  ) {
    return decision(false, "ENFORCEMENT_ACTIVE", "active content enforcement");
  }

  const required = actionCapabilityMap[input.action];
  if (required && !capabilityMatches(input, required)) {
    return decision(false, "MISSING_CAPABILITY", `missing ${required}`);
  }

  if (
    input.action.startsWith("queue.realm.") &&
    !input.realmMembership?.realmUnitId
  ) {
    return decision(false, "NOT_MEMBER", "realm membership is required");
  }

  return decision(true, "ALLOWED", "policy allowed");
}
