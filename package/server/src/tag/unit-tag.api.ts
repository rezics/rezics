import type { UnitTagDTO } from "@rezics/contract";
import {
  BasicAdminPermission,
  castTagVoteSchema,
  createUnitTagSchema,
  lowScoreTagsQuerySchema,
  patchUnitTagSchema,
  unitTagPathParamsSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, isAdminRole, tryResolveIdentity } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { mapUnitTagToDTO } from "./tag.mapper";
import { tagService, VISIBILITY_THRESHOLD } from "./tag.service";

/**
 * Authorization helper for pin/delete on a UnitTag.
 * Allowed: platform admin OR the owning unit's `userId`.
 * Rejected: any caller when `Unit.userId` is null and they are not admin.
 */
async function canMutateUnitTag(
  actorPermission: { role: string },
  actorUserId: string,
  unitId: string,
): Promise<boolean> {
  if (BasicAdminPermission(actorPermission as any)) return true;
  const unit = await unitService.getByUnitId(unitId);
  return unit?.userId != null && unit.userId === actorUserId;
}

export const unitTagApi = new Elysia({ prefix: "/unit-tags" })
  .use(authMacro)

  // POST /unit-tags — creation-as-vote (login)
  .post(
    "/",
    async ({ body, identity }): Promise<UnitTagDTO> => {
      const row = await tagService.createUnitTag(
        identity.userId,
        body.unitId,
        body.tagUnitId,
      );
      return mapUnitTagToDTO({ ...row, tag: undefined as any });
    },
    {
      requireLogin: true,
      body: createUnitTagSchema,
      detail: {
        summary: "Create UnitTag (creation-as-vote)",
        description:
          "Idempotent for the calling user. Writes a +1 TagVote on first call and recomputes UnitTag.score/voteCount.",
        tags: ["Tags"],
      },
    },
  )

  // PATCH /unit-tags/:unitId/:tagUnitId — pin / position (admin or unit owner)
  .patch(
    "/:unitId/:tagUnitId",
    async ({ params, body, identity, set }): Promise<UnitTagDTO> => {
      const allowed = await canMutateUnitTag(
        identity.permission,
        identity.userId,
        params.unitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error(
          "Forbidden: only platform admin or unit owner may pin tags",
        );
      }
      const row = await tagService.setUnitTagPin(
        params.unitId,
        params.tagUnitId,
        body,
      );
      return mapUnitTagToDTO({ ...row, tag: undefined as any });
    },
    {
      requireLogin: true,
      params: unitTagPathParamsSchema,
      body: patchUnitTagSchema,
      detail: {
        summary: "Pin/unpin or reposition a UnitTag",
        tags: ["Tags"],
      },
    },
  )

  // DELETE /unit-tags/:unitId/:tagUnitId — delete (admin or unit owner)
  .delete(
    "/:unitId/:tagUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const allowed = await canMutateUnitTag(
        identity.permission,
        identity.userId,
        params.unitId,
      );
      if (!allowed) {
        set.status = 403;
        throw new Error(
          "Forbidden: only platform admin or unit owner may delete tags",
        );
      }
      await tagService.deleteUnitTag(params.unitId, params.tagUnitId);
      return { message: "Unit tag deleted" };
    },
    {
      requireLogin: true,
      params: unitTagPathParamsSchema,
      detail: {
        summary: "Delete a UnitTag",
        description: "Removes the UnitTag and all underlying TagVote rows.",
        tags: ["Tags"],
      },
    },
  );

export const tagVoteApi = new Elysia({ prefix: "/tag-votes" })
  .use(authMacro)

  // POST /tag-votes — explicit vote action (login)
  .post(
    "/",
    async ({ body, identity }): Promise<{ message: string }> => {
      await tagService.castVote(
        identity.userId,
        body.unitId,
        body.tagUnitId,
        body.value,
      );
      return { message: "Vote cast" };
    },
    {
      requireLogin: true,
      body: castTagVoteSchema,
      detail: {
        summary: "Cast a TagVote",
        description:
          "Upserts the user's vote and recomputes UnitTag aggregates.",
        tags: ["Tags"],
      },
    },
  );

export const lowScoreTagsAdminApi = new Elysia({
  prefix: "/admin/low-score-tags",
})
  .use(authMacro)

  // GET /admin/low-score-tags — admin discovery
  .get(
    "/",
    async ({ headers, query, set }) => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      if (!isAdminRole(identity)) {
        set.status = 403;
        return status(403, "Forbidden: Admin role required");
      }

      const scope = query.scope ?? "global";
      const threshold = query.threshold ?? VISIBILITY_THRESHOLD;
      const limit = query.limit ?? 100;

      if (scope === "global") {
        const rows = await tagService.listLowScoreUnitTags(threshold, limit);
        return {
          scope: "global" as const,
          threshold,
          unitTags: rows.map((r) =>
            mapUnitTagToDTO(
              { ...r, tag: undefined as any },
              { belowVisibilityThreshold: true },
            ),
          ),
        };
      }

      // Realm scope is delegated to realmService via dynamic import to avoid
      // circular static imports between tag and realm modules.
      const { realmService } = await import("@/realm/realm.service");
      const { mapRealmTagUnitToDTO } = await import("@/realm/realm.mapper");
      const rows = await realmService.listLowScoreRealmTagUnits(
        threshold,
        limit,
        query.realmUnitId,
      );
      return {
        scope: "realm" as const,
        threshold,
        realmTagUnits: rows.map((r) =>
          mapRealmTagUnitToDTO(r, { belowVisibilityThreshold: true }),
        ),
      };
    },
    {
      query: lowScoreTagsQuerySchema,
      detail: {
        summary: "Admin: list low-score tag relations",
        description:
          "Returns UnitTag rows (scope=global, default) or RealmTagUnit rows (scope=realm) at or below the threshold (default -100), ordered by score asc.",
        tags: ["Admin", "Tags"],
      },
    },
  );
