import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现
export const GovernanceHandlers = HttpApiBuilder.group(
  Api,
  "governance",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("capabilityHintsMe", () => Effect.die("TODO: not implemented"))
      .handle("grantRealmCapability", () => Effect.die("TODO: not implemented"))
      .handle("revokeRealmCapability", () => Effect.die("TODO: not implemented"))
      .handle("policyDecide", () => Effect.die("TODO: not implemented"))
      .handle("listModerationActions", () => Effect.die("TODO: not implemented"))
      .handle("listModerationOverlays", () => Effect.die("TODO: not implemented"))
      .handle("contentApprove", () => Effect.die("TODO: not implemented"))
      .handle("contentRemove", () => Effect.die("TODO: not implemented"))
      .handle("contentRestore", () => Effect.die("TODO: not implemented"))
      .handle("realmContentApprove", () => Effect.die("TODO: not implemented"))
      .handle("realmContentRemove", () => Effect.die("TODO: not implemented"))
      .handle("realmContentRestore", () => Effect.die("TODO: not implemented"))
      .handle("realmContentLock", () => Effect.die("TODO: not implemented"))
      .handle("realmContentUnlock", () => Effect.die("TODO: not implemented"))
      .handle("realmContentOwnerDelegation", () => Effect.die("TODO: not implemented"))
      .handle("getActiveEnforcement", () => Effect.die("TODO: not implemented"))
      .handle("listEnforcements", () => Effect.die("TODO: not implemented"))
      .handle("applyEnforcement", () => Effect.die("TODO: not implemented"))
      .handle("unblockEnforcement", () => Effect.die("TODO: not implemented"))
      .handle("listCases", () => Effect.die("TODO: not implemented"))
      .handle("getCase", () => Effect.die("TODO: not implemented"))
      .handle("listCaseActions", () => Effect.die("TODO: not implemented"))
      .handle("createCaseFromFeedback", () => Effect.die("TODO: not implemented"))
      .handle("duplicateCase", () => Effect.die("TODO: not implemented"))
      .handle("assignCase", () => Effect.die("TODO: not implemented"))
      .handle("triageCase", () => Effect.die("TODO: not implemented"))
      .handle("decideCase", () => Effect.die("TODO: not implemented"))
      .handle("appealCase", () => Effect.die("TODO: not implemented"))
      .handle("listRealmCases", () => Effect.die("TODO: not implemented"))
      .handle("createRealmCase", () => Effect.die("TODO: not implemented"))
      .handle("createRealmCaseFromFeedback", () => Effect.die("TODO: not implemented"))
      .handle("listRealmCaseActions", () => Effect.die("TODO: not implemented"))
      .handle("decideRealmCase", () => Effect.die("TODO: not implemented"))
      .handle("escalateRealmCase", () => Effect.die("TODO: not implemented"))
      .handle("listAuditLogs", () => Effect.die("TODO: not implemented"))
      .handle("getAuditLog", () => Effect.die("TODO: not implemented"));
  }),
);
