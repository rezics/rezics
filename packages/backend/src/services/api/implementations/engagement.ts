import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现

export const SubscriptionHandlers = HttpApiBuilder.group(
  Api,
  "subscriptions",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("listMine", () => Effect.die("TODO: not implemented"))
      .handle("updateChannels", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"))
      .handle("check", () => Effect.die("TODO: not implemented"))
      .handle("count", () => Effect.die("TODO: not implemented"));
  }),
);

export const ReactionHandlers = HttpApiBuilder.group(
  Api,
  "reactions",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("remove", () => Effect.die("TODO: not implemented"))
      .handle("share", () => Effect.die("TODO: not implemented"));
  }),
);

export const FeedbackHandlers = HttpApiBuilder.group(
  Api,
  "feedback",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("listMine", () => Effect.die("TODO: not implemented"))
      .handle("listAll", () => Effect.die("TODO: not implemented"))
      .handle("resolve", () => Effect.die("TODO: not implemented"));
  }),
);

export const BlockHandlers = HttpApiBuilder.group(
  Api,
  "blocks",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("list", () => Effect.die("TODO: not implemented"))
      .handle("add", () => Effect.die("TODO: not implemented"))
      .handle("remove", () => Effect.die("TODO: not implemented"));
  }),
);

export const ProgressHandlers = HttpApiBuilder.group(
  Api,
  "progress",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("get", () => Effect.die("TODO: not implemented"))
      .handle("upsert", () => Effect.die("TODO: not implemented"))
      .handle("delete", () => Effect.die("TODO: not implemented"))
      .handle("list", () => Effect.die("TODO: not implemented"))
      .handle("nodeCompletion", () => Effect.die("TODO: not implemented"));
  }),
);

export const DraftHandlers = HttpApiBuilder.group(
  Api,
  "drafts",
  Effect.fn(function* (handlers) {
    return handlers.handle("list", () => Effect.die("TODO: not implemented"));
  }),
);

export const ActivityHandlers = HttpApiBuilder.group(
  Api,
  "activity",
  Effect.fn(function* (handlers) {
    return handlers.handle("list", () => Effect.die("TODO: not implemented"));
  }),
);

export const StreamHandlers = HttpApiBuilder.group(
  Api,
  "stream",
  Effect.fn(function* (handlers) {
    return handlers.handle("rows", () => Effect.die("TODO: not implemented"));
  }),
);
