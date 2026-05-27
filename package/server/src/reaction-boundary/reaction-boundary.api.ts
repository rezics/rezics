import { createSchema, deleteQuerySchema } from "@rezics/contract/reaction";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import {
  contentPolicyActions,
  governanceRoutePolicyService,
} from "@/governance";
import { authMacro } from "@/middleware";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { createReaction, removeReaction } from "./reaction-boundary.client";

export const reactionBoundaryApi = new Elysia({ prefix: "/reaction" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity, set, status }) => {
      const userId = identity.userId;
      const decision = await governanceRoutePolicyService.decideForIdentity({
        identity,
        action: contentPolicyActions.reactionCreate,
        target: { kind: "reaction", id: body.targetId },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }

      const result = await createReaction(userId, body.targetId, body.reaction);

      set.status = result.created ? 201 : 200;

      if (result.created) {
        prisma.unit
          .findUnique({
            where: { id: body.targetId },
            select: { userId: true },
          })
          .then((unit) => {
            if (unit?.userId && unit.userId !== userId) {
              broadcast({
                kind: "reaction.like",
                sourceUnitId: body.targetId,
                directRecipients: [unit.userId],
                actorId: userId,
                extra: {},
              }).catch(() => {});
            }
          })
          .catch(() => {});
      }

      return {
        id: result.id,
        userId: result.userId,
        targetId: result.targetId,
        reaction: result.reaction,
        createdAt: result.createdAt,
      };
    },
    {
      requireLogin: true,
      body: createSchema,
      detail: {
        summary: "Create reaction",
        description:
          "Adds a reaction to a unit. Triggers a notification to the unit owner.",
        tags: ["Reactions"],
      },
    },
  )
  .delete(
    "/",
    async ({ query, identity }) => {
      return removeReaction(identity.userId, query.targetId, query.reaction);
    },
    {
      requireLogin: true,
      query: deleteQuerySchema,
      detail: {
        summary: "Remove reaction",
        description: "Removes a reaction from a unit.",
        tags: ["Reactions"],
      },
    },
  );
