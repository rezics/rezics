import { Effect } from "effect";
import { HttpApiBuilder } from "effect/unstable/httpapi";

import { Api } from "../interfaces/index.ts";

// ponytail: stub — implement when porting domain logic
// ponytail: 桩——迁入领域逻辑时实现
export const ZonesHandlers = HttpApiBuilder.group(
  Api,
  "zones",
  Effect.fn(function* (handlers) {
    return handlers
      .handle("getMyZones", () => Effect.die("TODO: not implemented"))
      .handle("getByUser", () => Effect.die("TODO: not implemented"))
      .handle("getBySlug", () => Effect.die("TODO: not implemented"))
      .handle("getPortal", () => Effect.die("TODO: not implemented"))
      .handle("getSectionData", () => Effect.die("TODO: not implemented"))
      .handle("create", () => Effect.die("TODO: not implemented"))
      .handle("update", () => Effect.die("TODO: not implemented"))
      .handle("updateBoundary", () => Effect.die("TODO: not implemented"))
      .handle("updateNav", () => Effect.die("TODO: not implemented"))
      .handle("updateTheme", () => Effect.die("TODO: not implemented"))
      .handle("remove", () => Effect.die("TODO: not implemented"))
      .handle("createPage", () => Effect.die("TODO: not implemented"))
      .handle("updatePage", () => Effect.die("TODO: not implemented"))
      .handle("deletePage", () => Effect.die("TODO: not implemented"));
  }),
);
