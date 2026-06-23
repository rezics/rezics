import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现

export const UsersHandlers = HttpApiBuilder.group(
  Api,
  "users",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("listGet", () => Effect.die("TODO: not implemented"))
      .handle("listPost", () => Effect.die("TODO: not implemented"))
      .handle("getBySlug", () => Effect.die("TODO: not implemented"))
      .handle("getMe", () => Effect.die("TODO: not implemented"))
      .handle("updateMe", () => Effect.die("TODO: not implemented"))
      .handle("getById", () => Effect.die("TODO: not implemented"))
      .handle("batch", () => Effect.die("TODO: not implemented"))
      .handle("getSettings", () => Effect.die("TODO: not implemented"))
      .handle("updateSettings", () => Effect.die("TODO: not implemented"))
      .handle("getEmailVerification", () => Effect.die("TODO: not implemented"))
      .handle("requestEmailVerification", () => Effect.die("TODO: not implemented"))
      .handle("exportData", () => Effect.die("TODO: not implemented"))
      .handle("deleteAccount", () => Effect.die("TODO: not implemented"))
      .handle("adminGet", () => Effect.die("TODO: not implemented"))
      .handle("adminUpdate", () => Effect.die("TODO: not implemented"))
      .handle("adminDelete", () => Effect.die("TODO: not implemented"))
      .handle("getFollowers", () => Effect.die("TODO: not implemented"))
      .handle("getFollowings", () => Effect.die("TODO: not implemented"))
      .handle("getBrief", () => Effect.die("TODO: not implemented"))
      .handle("batchBriefs", () => Effect.die("TODO: not implemented"));
  }),
);

export const ProfileHandlers = HttpApiBuilder.group(
  Api,
  "profile",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("reactionGiven", () => Effect.die("TODO: not implemented"))
      .handle("reactionReceived", () => Effect.die("TODO: not implemented"));
  }),
);
