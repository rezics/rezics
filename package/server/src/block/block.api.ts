import {
  type BlockListResponse,
  blockListResponseSchema,
  createBlockBodySchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { blockService } from "./block.service";

export const blockApi = new Elysia({ prefix: "/block" })
  .use(authMacro)
  .get(
    "/list",
    async ({ identity }): Promise<BlockListResponse> => {
      const items = await blockService.listBlocked(identity.userId);
      return { items };
    },
    {
      requireLogin: true,
      response: blockListResponseSchema,
      detail: {
        summary: "List my blocked users",
        description:
          "Returns the users the current user has blocked, newest first.",
        tags: ["Blocks"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity, status }) => {
      if (body.userId === identity.userId) {
        return status(400, "Cannot block yourself");
      }
      await blockService.add(identity.userId, body.userId);
      return { success: true };
    },
    {
      requireLogin: true,
      body: createBlockBodySchema,
      response: {
        200: t.Object({ success: t.Boolean() }),
        400: t.String(),
      },
      detail: {
        summary: "Block a user",
        description:
          "Blocks a user: hides their content from your feeds and prevents direct messages in either direction. Idempotent.",
        tags: ["Blocks"],
      },
    },
  )
  .delete(
    "/:userId",
    async ({ params, identity }) => {
      await blockService.remove(identity.userId, params.userId);
      return { success: true };
    },
    {
      requireLogin: true,
      params: t.Object({ userId: t.String() }),
      response: {
        200: t.Object({ success: t.Boolean() }),
      },
      detail: {
        summary: "Unblock a user",
        description:
          "Removes a block. The peer's content becomes visible again on next fetch. No-op if not blocked.",
        tags: ["Blocks"],
      },
    },
  );
