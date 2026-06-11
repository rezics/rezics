import type { FeedResponse } from "@rezics/contract";
import { feedQuerySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { feedService } from "./feed.service";

export const feedApi = new Elysia({ prefix: "/feed" }).use(authMacro).get(
  "/rows",
  async ({ headers, query }): Promise<FeedResponse> => {
    const identity = await tryResolveIdentity(
      headers["authorization"],
      headers["cookie"],
    );
    return feedService.list(query, {
      isAdmin: isAdminRole(identity),
      viewerUserId: identity?.userId,
    });
  },
  {
    query: feedQuerySchema,
    detail: {
      summary: "List feed rows",
      description:
        "Return ordered feed rows for home, realm, or library scopes. V1 emits post rows from the existing post list service plus scheduled single-row book and shelf recommendations.",
      tags: ["Feed"],
    },
  },
);
