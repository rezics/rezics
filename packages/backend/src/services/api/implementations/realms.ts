import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现

export const RealmsHandlers = HttpApiBuilder.group(
  Api,
  "realms",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("listMine", () => Effect.die("TODO: not implemented"))
      .handle("listByMember", () => Effect.die("TODO: not implemented"))
      .handle("getBySlug", () => Effect.die("TODO: not implemented"))
      .handle("list", () => Effect.die("TODO: not implemented"))
      .handle("listByFilter", () => Effect.die("TODO: not implemented"))
      .handle("getById", () => Effect.die("TODO: not implemented"))
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"))
      .handle("getMyMembership", () => Effect.die("TODO: not implemented"))
      .handle("listMembers", () => Effect.die("TODO: not implemented"))
      .handle("addMember", () => Effect.die("TODO: not implemented"))
      .handle("updateMember", () => Effect.die("TODO: not implemented"))
      .handle("removeMember", () => Effect.die("TODO: not implemented"))
      .handle("getResolvedRules", () => Effect.die("TODO: not implemented"))
      .handle("listRules", () => Effect.die("TODO: not implemented"))
      .handle("createRule", () => Effect.die("TODO: not implemented"))
      .handle("createRuleRevision", () => Effect.die("TODO: not implemented"))
      .handle("acknowledgeRules", () => Effect.die("TODO: not implemented"))
      .handle("mute", () => Effect.die("TODO: not implemented"))
      .handle("unmute", () => Effect.die("TODO: not implemented"))
      .handle("addContent", () => Effect.die("TODO: not implemented"))
      .handle("removeContent", () => Effect.die("TODO: not implemented"))
      .handle("addTags", () => Effect.die("TODO: not implemented"))
      .handle("removeTags", () => Effect.die("TODO: not implemented"))
      .handle("getDock", () => Effect.die("TODO: not implemented"))
      .handle("updateDock", () => Effect.die("TODO: not implemented"))
      .handle("setExtra", () => Effect.die("TODO: not implemented"))
      .handle("deleteExtra", () => Effect.die("TODO: not implemented"))
      .handle("getTagTree", () => Effect.die("TODO: not implemented"))
      .handle("updateTagTree", () => Effect.die("TODO: not implemented"))
      .handle("getPinboard", () => Effect.die("TODO: not implemented"))
      .handle("addPinboardEntry", () => Effect.die("TODO: not implemented"))
      .handle("reorderPinboard", () => Effect.die("TODO: not implemented"))
      .handle("deletePinboardEntry", () => Effect.die("TODO: not implemented"));
  }),
);

export const RealmTagApplicationsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplications",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("listForUnit", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"));
  }),
);

export const RealmTagApplicationVotesHandlers = HttpApiBuilder.group(
  Api,
  "realmTagApplicationVotes",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"));
  }),
);

export const RealmTagContextsHandlers = HttpApiBuilder.group(
  Api,
  "realmTagContexts",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("get", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("materialize", () => Effect.die("TODO: not implemented"));
  }),
);
