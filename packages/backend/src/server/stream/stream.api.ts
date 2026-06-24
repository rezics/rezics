import type { StreamResponse } from "@rezics/contract";
import { streamQuerySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { streamService } from "./stream.service";

export const streamApi = new Elysia({ prefix: "/stream" }).use(authMacro).get(
  "/rows",
  async ({ headers, query }): Promise<StreamResponse> => {
    const identity = await tryResolveIdentity(
      headers["authorization"],
      headers["cookie"],
    );
    return streamService.list(query, {
      isAdmin: isAdminRole(identity),
      viewerUserId: identity?.userId,
    });
  },
  {
    query: streamQuerySchema,
    detail: {
      summary: "List stream rows",
      description:
        "Return ordered stream rows for home, realm, or library scopes. V1 emits post rows from the existing post list service plus scheduled single-row book and shelf recommendations.",
      tags: ["Stream"],
    },
  },
);
