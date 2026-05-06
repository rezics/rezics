import type {
  AttachTagInput,
  BatchTagTranslationResult,
  CastTagVoteInput,
  CreateTagInput,
  TagListQuery,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";
import {
  attachTagSchema,
  BasicAdminPermission,
  batchTagTranslationQuerySchema,
  castTagVoteSchema,
  createTagSchema,
  detachTagSchema,
  tagListBodySchema,
  tagListQuerySchema,
  tagParamsSchema,
  updateTagSchema,
} from "@rezics/contract";
import { Elysia, status, t } from "elysia";
import { authMacro, tryResolveIdentity, verifyAdminFromDb } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { mapTagUnitToDTO, mapUnitTagToDTO } from "./tag.mapper";
import { tagService, VISIBILITY_THRESHOLD } from "./tag.service";
import { getTagContext } from "./tag-context.service";

export const tagApi = new Elysia({ prefix: "/tag" })
  .use(authMacro)

  // GET /list - list tags (search by name in language)
  .get(
    "/list",
    async ({ query }) => {
      const q = query as TagListQuery;
      const { tags, total } = await tagService.list(q);
      return {
        tags: tags.map((t) => mapTagUnitToDTO(t, q.language)),
        total,
      };
    },
    {
      query: tagListQuerySchema,
      detail: {
        summary: "List tags",
        description:
          "List tag Units with optional name search and language filter",
        tags: ["Tags"],
      },
    },
  )

  // POST /list - list tags via POST body
  .post(
    "/list",
    async ({ body }) => {
      const q = { ...body, ids: body.ids?.join(",") } as TagListQuery;
      const { tags, total } = await tagService.list(q);
      return {
        tags: tags.map((t) => mapTagUnitToDTO(t, q.language)),
        total,
      };
    },
    {
      body: tagListBodySchema,
      detail: {
        summary: "List tags (POST)",
        description:
          "List tags via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Tags"],
      },
    },
  )

  // GET /batch-translations - resolve translations for a batch of tag unit IDs
  .get(
    "/batch-translations",
    async ({ query }): Promise<BatchTagTranslationResult> => {
      const unitIds = (query.unitIds ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      return tagService.batchTranslations(unitIds, query.lang);
    },
    {
      query: batchTagTranslationQuerySchema,
      detail: {
        summary: "Batch tag translations",
        description:
          "Resolve translated name/slug/description for an array of tag unit IDs in the requested language.",
        tags: ["Tags"],
      },
    },
  )

  // GET /by-slug/:slug - get tag by slug (404 if slug resolves to a non-tag)
  .get(
    "/by-slug/:slug",
    async ({ params, set }) => {
      const unit = await unitService.getBySlug(params.slug);
      if (!unit || unit.type !== "TAG") {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Tag not found" } };
      }
      const tag = await tagService.getByUnitId(unit.id);
      return mapTagUnitToDTO(tag);
    },
    {
      params: t.Object({ slug: t.String({ minLength: 1 }) }),
      detail: {
        summary: "Get tag by slug",
        description:
          "Look up a tag by its slug (404 if slug resolves to a non-tag unit)",
        tags: ["Tags"],
      },
    },
  )

  // GET /:unitId - get tag by unitId
  .get(
    "/:unitId",
    async ({ params }) => {
      const tag = await tagService.getByUnitId(params.unitId);
      return mapTagUnitToDTO(tag);
    },
    {
      params: tagParamsSchema,
      detail: { summary: "Get tag by unitId", tags: ["Tags"] },
    },
  )

  // POST / - create tag (requires login)
  .post(
    "/",
    async ({ body, identity }) => {
      const created = await tagService.create(
        identity.userId,
        body as CreateTagInput,
      );
      return mapTagUnitToDTO(created);
    },
    {
      requireLogin: true,
      body: createTagSchema,
      detail: { summary: "Create tag", tags: ["Tags"] },
    },
  )

  // PUT /:unitId - update tag (admin)
  .put(
    "/:unitId",
    async ({ params, body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const updated = await tagService.update(
        params.unitId,
        body as UpdateTagInput,
      );
      return mapTagUnitToDTO(updated);
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      body: updateTagSchema,
      detail: { summary: "Update tag (admin)", tags: ["Tags"] },
    },
  )

  // DELETE /:unitId - delete tag (admin)
  .delete(
    "/:unitId",
    async ({ params, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      await tagService.delete(params.unitId);
      return { message: "Tag deleted successfully" };
    },
    {
      requireLogin: true,
      params: tagParamsSchema,
      detail: { summary: "Delete tag (admin)", tags: ["Tags"] },
    },
  )

  // POST /attach - attach tag to unit (admin); records the attach as the
  // admin actor's +1 vote so score derivation stays uniform.
  .post(
    "/attach",
    async ({ body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { tagUnitId, unitId } = body as AttachTagInput;
      await tagService.attachToUnit(tagUnitId, unitId, identity.userId);
      return { message: "Tag attached successfully" };
    },
    {
      requireLogin: true,
      body: attachTagSchema,
      detail: { summary: "Attach tag to unit (admin)", tags: ["Tags"] },
    },
  )

  // POST /detach - detach tag from unit (admin)
  .post(
    "/detach",
    async ({ body, identity }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { tagUnitId, unitId } = body as AttachTagInput;
      await tagService.detachFromUnit(tagUnitId, unitId);
      return { message: "Tag detached successfully" };
    },
    {
      requireLogin: true,
      body: detachTagSchema,
      detail: { summary: "Detach tag from unit (admin)", tags: ["Tags"] },
    },
  )

  // POST /vote - cast tag vote (requires login)
  .post(
    "/vote",
    async ({ body, identity }) => {
      const { tagUnitId, unitId, value } = body as CastTagVoteInput;
      await tagService.castVote(identity.userId, unitId, tagUnitId, value);
      return { message: "Vote cast successfully" };
    },
    {
      requireLogin: true,
      body: castTagVoteSchema,
      detail: { summary: "Cast tag vote", tags: ["Tags"] },
    },
  )

  // GET /for-unit/:unitId/context - get tag context for a unit
  .get(
    "/for-unit/:unitId/context",
    async ({ headers, params }) => {
      const identity = await tryResolveIdentity(headers["authorization"]);
      const unit = await unitService.getByUnitId(params.unitId);
      const isPrivileged =
        (identity && BasicAdminPermission(identity.permission)) ||
        (identity?.userId != null && unit?.userId === identity.userId);
      return getTagContext(params.unitId, identity?.userId ?? undefined, {
        includeBelowThreshold: isPrivileged,
      });
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tag context for a unit",
        description:
          "Pin-first/score-desc ordering. Rows with score ≤ -100 are hidden from regular callers and surfaced (with a flag) to admins / unit owner.",
        tags: ["Tags"],
      },
    },
  )

  // GET /for-unit/:unitId - get tags for a specific unit
  .get(
    "/for-unit/:unitId",
    async ({ headers, params }): Promise<{ tags: UnitTagDTO[] }> => {
      const identity = await tryResolveIdentity(headers["authorization"]);
      const unit = await unitService.getByUnitId(params.unitId);
      const isPrivileged =
        (identity && BasicAdminPermission(identity.permission)) ||
        (identity?.userId != null && unit?.userId === identity.userId);

      const unitTags = await tagService.getTagsForUnit(params.unitId, {
        includeBelowThreshold: isPrivileged,
      });
      return {
        tags: unitTags.map((ut) =>
          mapUnitTagToDTO(ut, {
            belowVisibilityThreshold:
              isPrivileged && ut.score <= VISIBILITY_THRESHOLD,
          }),
        ),
      };
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tags for a unit",
        description:
          "Pin-first/score-desc ordering. Rows with score ≤ -100 are hidden from regular callers and surfaced (with a flag) to admins / unit owner.",
        tags: ["Tags"],
      },
    },
  );
