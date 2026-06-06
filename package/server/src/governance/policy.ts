import type {
  Capability,
  DecisionCode,
  PolicyDecision,
  PolicyInput,
} from "@rezics/contract";
import { governanceActionDefinitionByAction } from "./action/registry";

const enforcementRestrictedActions = new Set([
  "content.create",
  "realm.create",
  "dm.send",
  "tag.vote",
  "reaction.create",
]);

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
  if (input.permission?.role === "ROOT") return true;

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
  const definition = governanceActionDefinitionByAction.get(input.action);

  if (input.context?.missingResource === true) {
    return decision(false, "MISSING_RESOURCE", "target resource is missing");
  }

  if (
    definition?.staffOnly &&
    input.permission?.role !== "ADMIN" &&
    input.permission?.role !== "ROOT"
  ) {
    return decision(false, "INSUFFICIENT_ROLE", "staff role is required");
  }

  if (input.activeEnforcement?.activeKinds.includes("ban")) {
    return decision(false, "BLOCKED_ACCOUNT", "active ban enforcement");
  }

  if (
    input.activeEnforcement?.activeKinds.some((kind) =>
      ["silence", "suspension", "rate_limit", "trust_restriction"].includes(
        kind,
      ),
    ) &&
    enforcementRestrictedActions.has(input.action)
  ) {
    return decision(false, "ENFORCEMENT_ACTIVE", "active action enforcement");
  }

  if (
    definition?.realmScoped &&
    input.target?.realmUnitId &&
    input.realmMembership?.realmUnitId &&
    input.target.realmUnitId !== input.realmMembership.realmUnitId
  ) {
    return decision(false, "CROSS_REALM_DENIED", "realm scope mismatch");
  }

  if (
    definition?.requiredCapability &&
    !capabilityMatches(input, definition.requiredCapability)
  ) {
    return decision(
      false,
      "MISSING_CAPABILITY",
      `missing ${definition.requiredCapability}`,
    );
  }

  if (
    input.action.startsWith("queue.realm.") &&
    !input.realmMembership?.realmUnitId
  ) {
    return decision(false, "NOT_MEMBER", "realm membership is required");
  }

  return decision(true, "ALLOWED", "policy allowed");
}
