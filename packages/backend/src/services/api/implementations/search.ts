import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现
export const SearchHandlers = HttpApiBuilder.group(
  Api,
  "search",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("health", () => Effect.die("TODO: not implemented"))
      .handle("status", () => Effect.die("TODO: not implemented"))
      .handle("searchContent", () => Effect.die("TODO: not implemented"))
      .handle("searchUsers", () => Effect.die("TODO: not implemented"))
      .handle("searchEntities", () => Effect.die("TODO: not implemented"))
      .handle("searchPosts", () => Effect.die("TODO: not implemented"))
      .handle("searchPolls", () => Effect.die("TODO: not implemented"))
      .handle("searchComments", () => Effect.die("TODO: not implemented"))
      .handle("searchRealms", () => Effect.die("TODO: not implemented"))
      .handle("searchZones", () => Effect.die("TODO: not implemented"))
      .handle("searchTags", () => Effect.die("TODO: not implemented"))
      .handle("searchLabels", () => Effect.die("TODO: not implemented"))
      .handle("searchFederated", () => Effect.die("TODO: not implemented"))
      .handle("initContentIndex", () => Effect.die("TODO: not implemented"))
      .handle("initUsersIndex", () => Effect.die("TODO: not implemented"))
      .handle("initPostsIndex", () => Effect.die("TODO: not implemented"))
      .handle("initPollsIndex", () => Effect.die("TODO: not implemented"))
      .handle("initRealmsIndex", () => Effect.die("TODO: not implemented"))
      .handle("initZonesIndex", () => Effect.die("TODO: not implemented"))
      .handle("initTagsIndex", () => Effect.die("TODO: not implemented"))
      .handle("initLabelsIndex", () => Effect.die("TODO: not implemented"))
      .handle("initEntitiesIndex", () => Effect.die("TODO: not implemented"))
      .handle("initFeedbacksIndex", () => Effect.die("TODO: not implemented"))
      .handle("initProgressIndex", () => Effect.die("TODO: not implemented"))
      .handle("syncContent", () => Effect.die("TODO: not implemented"))
      .handle("syncUsers", () => Effect.die("TODO: not implemented"))
      .handle("syncPosts", () => Effect.die("TODO: not implemented"))
      .handle("syncPolls", () => Effect.die("TODO: not implemented"))
      .handle("syncRealms", () => Effect.die("TODO: not implemented"))
      .handle("syncZones", () => Effect.die("TODO: not implemented"))
      .handle("syncTags", () => Effect.die("TODO: not implemented"))
      .handle("syncLabels", () => Effect.die("TODO: not implemented"))
      .handle("syncEntities", () => Effect.die("TODO: not implemented"))
      .handle("syncFeedbacks", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllContent", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllFeedbacks", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllUsers", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllPosts", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllPolls", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllRealms", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllZones", () => Effect.die("TODO: not implemented"))
      .handle("deleteAllEntities", () => Effect.die("TODO: not implemented"))
      .handle("resetAllIndexes", () => Effect.die("TODO: not implemented"))
      .handle("createAdminKey", () => Effect.die("TODO: not implemented"))
      .handle("listKeys", () => Effect.die("TODO: not implemented"))
      .handle("deleteKey", () => Effect.die("TODO: not implemented"));
  }),
);
