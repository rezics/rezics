import {
  createSchema,
  deleteQuerySchema,
  normalizeReactionScopeKey,
  parseReactionScopeKey,
} from "@rezics/contract/reaction";
import { eq } from "drizzle-orm";
import { Elysia } from "elysia";
import { Unit } from "../db/schema";
import {
  contentPolicyActions,
  governanceCapabilityService,
  governanceRoutePolicyService,
} from "@/governance";
import { authMacro } from "@/middleware";
import { broadcast } from "@/notify-boundary/notify-boundary.client";
import { createReaction, removeReaction } from "./reaction-boundary.client";

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

async function resolveScopedReactionPolicy(input: {
  scopeKey: string;
  identity: { userId: string };
  findPolicyRealm: NonNullable<ReactionBoundaryDeps["findPolicyRealm"]>;
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

  const realm = await input.findPolicyRealm(scope.realmUnitId);
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

export function createReactionBoundaryApi(deps: ReactionBoundaryDeps = {}) {
  const findPolicyRealm = deps.findPolicyRealm ?? findReactionPolicyRealm;
  const findTargetOwner = deps.findTargetOwner ?? findReactionTargetOwner;

  return new Elysia({ prefix: "/reaction" })
    .use(authMacro)
    .post(
      "/",
      async ({ body, identity, set, status }) => {
        const userId = identity.userId;
        const scopeKey = normalizeReactionScopeKey(body.scopeKey);
        const scopePolicy = await resolveScopedReactionPolicy({
          scopeKey,
          identity,
          findPolicyRealm,
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
          findTargetOwner(body.targetId)
            .then((ownerUserId) => {
              if (ownerUserId && ownerUserId !== userId) {
                broadcast({
                  kind: "reaction.like",
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
          findPolicyRealm,
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
}

export const reactionBoundaryApi = createReactionBoundaryApi();
