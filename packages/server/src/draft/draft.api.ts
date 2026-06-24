import {
  draftListQuerySchema,
  draftListResponseSchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { authMacro } from "@/middleware";
import { draftService } from "./draft.service";

export const draftApi = new Elysia().use(authMacro).get(
  "/me/drafts",
  async ({ identity, query }) => {
    const drafts = await draftService.listMine(identity.userId, {
      limit: query.limit,
    });
    return { drafts };
  },
  {
    requireLogin: true,
    query: draftListQuerySchema,
    response: { 200: draftListResponseSchema },
    detail: {
      summary: "List the current user's drafts",
      description:
        "Cross-type listing of the user's draft-status content (review/post/remark/wiki), newest first, for the drafts page.",
      tags: ["Drafts"],
    },
  },
);
