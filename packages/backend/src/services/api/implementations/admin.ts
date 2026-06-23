import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现
export const AdminHandlers = HttpApiBuilder.group(
  Api,
  "admin",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("authUsersSummary", () => Effect.die("TODO: not implemented"))
      .handle("authUsersSessions", () => Effect.die("TODO: not implemented"))
      .handle("authUsersRevoke", () => Effect.die("TODO: not implemented"))
      .handle("authUsersImpersonate", () => Effect.die("TODO: not implemented"))
      .handle("repairDryRun", () => Effect.die("TODO: not implemented"))
      .handle("repairCreate", () => Effect.die("TODO: not implemented"))
      .handle("repairRetry", () => Effect.die("TODO: not implemented"))
      .handle("repairCancel", () => Effect.die("TODO: not implemented"))
      .handle("stats", () => Effect.die("TODO: not implemented"))
      .handle("dashboardSummary", () => Effect.die("TODO: not implemented"))
      .handle("listJwtServices", () => Effect.die("TODO: not implemented"))
      .handle("createJwtService", () => Effect.die("TODO: not implemented"))
      .handle("updateJwtService", () => Effect.die("TODO: not implemented"))
      .handle("activateJwtService", () => Effect.die("TODO: not implemented"))
      .handle("deactivateJwtService", () => Effect.die("TODO: not implemented"))
      .handle("rotateJwtService", () => Effect.die("TODO: not implemented"))
      .handle("historyRetryFailed", () => Effect.die("TODO: not implemented"))
      .handle("diagnosticSystem", () => Effect.die("TODO: not implemented"))
      .handle("echokvGet", () => Effect.die("TODO: not implemented"))
      .handle("echokvPut", () => Effect.die("TODO: not implemented"))
      .handle("slugResolve", () => Effect.die("TODO: not implemented"))
      .handle("dispatchResults", () => Effect.die("TODO: not implemented"))
      .handle("dmSend", () => Effect.die("TODO: not implemented"))
      .handle("labelList", () => Effect.die("TODO: not implemented"))
      .handle("labelCreate", () => Effect.die("TODO: not implemented"))
      .handle("linkCreate", () => Effect.die("TODO: not implemented"))
      .handle("linkList", () => Effect.die("TODO: not implemented"))
      .handle("linkUpdate", () => Effect.die("TODO: not implemented"))
      .handle("linkDelete", () => Effect.die("TODO: not implemented"))
      .handle("tokenList", () => Effect.die("TODO: not implemented"))
      .handle("tokenCreate", () => Effect.die("TODO: not implemented"))
      .handle("tokenUpdate", () => Effect.die("TODO: not implemented"))
      .handle("tokenDelete", () => Effect.die("TODO: not implemented"))
      .handle("tokenBooksList", () => Effect.die("TODO: not implemented"))
      .handle("tokenBooksCreate", () => Effect.die("TODO: not implemented"))
      .handle("tokenBooksUpdate", () => Effect.die("TODO: not implemented"))
      .handle("tokenUsersList", () => Effect.die("TODO: not implemented"))
      .handle("tokenUsersCreate", () => Effect.die("TODO: not implemented"))
      .handle("tokenUsersUpdate", () => Effect.die("TODO: not implemented"))
      .handle("gameSystemRequirementList", () => Effect.die("TODO: not implemented"))
      .handle("gameSystemRequirementCreate", () => Effect.die("TODO: not implemented"))
      .handle("gameSystemRequirementUpdate", () => Effect.die("TODO: not implemented"))
      .handle("gameSystemRequirementDelete", () => Effect.die("TODO: not implemented"));
  }),
);
