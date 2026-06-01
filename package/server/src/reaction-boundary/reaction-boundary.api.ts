import {
  createSchema,
  deleteQuerySchema,
  normalizeReactionScopeKey,
  parseReactionScopeKey,
} from "@rezics/contract/reaction";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import {
  contentPolicyActions,
  governanceCapabilityService,
  governanceRoutePolicyService,
} from "@/governance";
import { authMacro } from "@/middleware";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { createReaction, removeReaction } from "./reaction-boundary.client";

async function resolveScopedReactionPolicy(input: {
  scopeKey: string;
  identity: { userId: string };
}) {
  const scope = parseReactionScopeKey(input.scopeKey);
  if (!scope) {
    return {
      allowed: false as const,
      status: 400,
      message: "Invalid reaction scope",
    };
  }
  if (scope.kind === "direct") return { allowed: true as const };

  const realm = await prisma.unit.findUnique({
    where: { id: scope.realmUnitId },
    select: { id: true, type: true, visibility: true },
  });
  if (!realm || realm.type !== "REALM") {
    return { allowed: false as const, status: 404, message: "Realm not found" };
  }
  if (realm.visibility !== "PUBLIC") {
    const membership =
      await governanceCapabilityService.realmMembershipForPolicy(
        scope.realmUnitId,
        input.identity.userId,
      );
    if (!membership) {
      return {
        allowed: false as const,
        status: 403,
        message: "Forbidden: realm membership required",
      };
    }
  }
  return { allowed: true as const, realmUnitId: scope.realmUnitId };
}

export const reactionBoundaryApi = new Elysia({ prefix: "/reaction" })
  .use(authMacro)
  .post(
    "/",
    async ({ body, identity, set, status }) => {
      const userId = identity.userId;
      const scopeKey = normalizeReactionScopeKey(body.scopeKey);
      const scopePolicy = await resolveScopedReactionPolicy({
        scopeKey,
        identity,
      });
      if (!scopePolicy.allowed) {
        return status(scopePolicy.status, scopePolicy.message);
      }
      const decision = await governanceRoutePolicyService.decideForIdentity({
        identity,
        action: contentPolicyActions.reactionCreate,
        target: {
          kind: "reaction",
          id: body.targetId,
          ...(scopePolicy.realmUnitId
            ? { realmUnitId: scopePolicy.realmUnitId }
            : {}),
        },
      });
      if (!decision.allowed) {
        return status(
          403,
          decision.safeMessage ?? "Forbidden: policy denied this action",
        );
      }

      const result = await createReaction(
        userId,
        body.targetId,
        body.reaction,
        scopeKey,
      );

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
        scopeKey: result.scopeKey,
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
    async ({ query, identity, status }) => {
      const scopeKey = normalizeReactionScopeKey(query.scopeKey);
      const scopePolicy = await resolveScopedReactionPolicy({
        scopeKey,
        identity,
      });
      if (!scopePolicy.allowed) {
        return status(scopePolicy.status, scopePolicy.message);
      }
      return removeReaction(
        identity.userId,
        query.targetId,
        query.reaction,
        scopeKey,
      );
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
