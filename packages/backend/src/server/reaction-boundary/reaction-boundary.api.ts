import {
  createSchema,
  createShareResponseSchema,
  createShareSchema,
  deleteQuerySchema,
  normalizeReactionContextUnitId,
} from "@rezics/contract/reaction";
import { eq } from "drizzle-orm";
import { Elysia, t } from "elysia";
import {
  contentPolicyActions,
  governanceCapabilityService,
  governanceRoutePolicyService,
} from "@/governance";
import { authMacro } from "@/middleware";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { Unit } from "../db/schema";
import {
  createReaction,
  recordShare,
  removeReaction,
} from "./reaction-boundary.client";

type ReactionBoundaryDeps = {
  findPolicyRealm?: (realmUnitId: string) => Promise<
    | {
        id: string;
        type: string;
        visibility: string;
      }
    | undefined
  >;
  findTargetOwner?: (targetId: string) => Promise<string | null>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function findReactionPolicyRealm(realmUnitId: string) {
  const db = await getServerDb();
  const [realm] = await db
    .select({ id: Unit.id, type: Unit.type, visibility: Unit.visibility })
    .from(Unit)
    .where(eq(Unit.id, realmUnitId))
    .limit(1);
  return realm;
}

async function findReactionTargetOwner(targetId: string) {
  const db = await getServerDb();
  const [unit] = await db
    .select({ userId: Unit.userId })
    .from(Unit)
    .where(eq(Unit.id, targetId))
    .limit(1);
  return unit?.userId ?? null;
}

async function resolveContextReactionPolicy(input: {
  contextUnitId: string | null;
  identity: { userId: string };
  findPolicyRealm: NonNullable<ReactionBoundaryDeps["findPolicyRealm"]>;
}) {
  if (!input.contextUnitId) return { allowed: true as const };

  // Reaction context is Unit-backed. The only supported context Unit today is
  // realm; future context types extend this policy branch without changing
  // reaction storage.
  const realm = await input.findPolicyRealm(input.contextUnitId);
  if (!realm || realm.type !== "REALM") {
    return { allowed: false as const, status: 404, message: "Realm not found" };
  }
  if (realm.visibility !== "PUBLIC") {
    const membership =
      await governanceCapabilityService.realmMembershipForPolicy(
        input.contextUnitId,
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
  return { allowed: true as const, realmUnitId: input.contextUnitId };
}

export function createReactionBoundaryApi(deps: ReactionBoundaryDeps = {}) {
  const findPolicyRealm = deps.findPolicyRealm ?? findReactionPolicyRealm;
  const findTargetOwner = deps.findTargetOwner ?? findReactionTargetOwner;

  return new Elysia({ prefix: "/reaction" })
    .use(authMacro)
    .post(
      "/",
      async ({ body, identity, set, status }) => {
        const userId = identity.userId;
        const contextUnitId = normalizeReactionContextUnitId(
          body.contextUnitId,
        );
        const contextPolicy = await resolveContextReactionPolicy({
          contextUnitId,
          identity,
          findPolicyRealm,
        });
        if (!contextPolicy.allowed) {
          return status(contextPolicy.status, contextPolicy.message);
        }
        const decision = await governanceRoutePolicyService.decideForIdentity({
          identity,
          action: contentPolicyActions.reactionCreate,
          target: {
            kind: "reaction",
            id: body.targetId,
            ...(contextPolicy.realmUnitId
              ? { realmUnitId: contextPolicy.realmUnitId }
              : {}),
          },
        });
        if (!decision.allowed) {
          set.status = 403;
          return decision.safeMessage ?? "Forbidden: policy denied this action";
        }

        const result = await createReaction(
          userId,
          body.targetId,
          body.reaction,
          contextUnitId,
        );

        set.status = result.created ? 201 : 200;

        // Downvotes are private ranking signals; only upvotes notify target owners.
        // 反对票是私有的排序信号；只有赞同票才会通知目标所有者。
        if (result.created && body.reaction === "upvote") {
          findTargetOwner(body.targetId)
            .then((ownerUserId) => {
              if (ownerUserId && ownerUserId !== userId) {
                broadcast({
                  kind: "reaction.upvote",
                  sourceUnitId: body.targetId,
                  directRecipients: [ownerUserId],
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
          contextUnitId: result.contextUnitId,
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
    .post(
      "/share",
      async ({ body, identity, set, status }) => {
        const decision = await governanceRoutePolicyService.decideForIdentity({
          identity,
          action: contentPolicyActions.reactionCreate,
          target: {
            kind: "reaction",
            id: body.targetId,
          },
        });
        if (!decision.allowed) {
          return status(
            403,
            decision.safeMessage ?? "Forbidden: policy denied this action",
          );
        }

        const result = await recordShare(identity.userId, body.targetId);
        set.status = result.created ? 201 : 200;
        return result;
      },
      {
        requireLogin: true,
        body: createShareSchema,
        response: {
          200: createShareResponseSchema,
          201: createShareResponseSchema,
          403: t.String(),
        },
        detail: {
          summary: "Record share intent",
          description:
            "Records one monotonic authenticated share intent for the target Unit.",
          tags: ["Reactions"],
        },
      },
    )
    .delete(
      "/",
      async ({ query, identity, status }) => {
        const contextUnitId = normalizeReactionContextUnitId(
          query.contextUnitId,
        );
        const contextPolicy = await resolveContextReactionPolicy({
          contextUnitId,
          identity,
          findPolicyRealm,
        });
        if (!contextPolicy.allowed) {
          return status(contextPolicy.status, contextPolicy.message);
        }
        return removeReaction(
          identity.userId,
          query.targetId,
          query.reaction,
          contextUnitId,
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
}

export const reactionBoundaryApi = createReactionBoundaryApi();
