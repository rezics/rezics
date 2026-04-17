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
  batchTagTranslationQuerySchema,
  castTagVoteSchema,
  createTagSchema,
  detachTagSchema,
  tagListQuerySchema,
  tagParamsSchema,
  updateTagSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { mapTagUnitToDTO, mapUnitTagToDTO } from "./tag.mapper";
import { getTagContext } from "./tag-context.service";
import { tagService } from "./tag.service";

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
        identity.unitId,
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
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
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
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
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

  // POST /attach - attach tag to unit (admin)
  .post(
    "/attach",
    async ({ body, identity }) => {
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { tagUnitId, unitId } = body as AttachTagInput;
      await tagService.attachToUnit(tagUnitId, unitId);
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
      if (identity.permission.role !== "ADMIN" && identity.permission.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
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
      await tagService.castVote(identity.unitId, unitId, tagUnitId, value);
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
    async ({ params }) => {
      return getTagContext(params.unitId);
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tag context for a unit",
        description:
          "Get global tags and realm-specific tag highlights for a unit",
        tags: ["Tags"],
      },
    },
  )

  // GET /for-unit/:unitId - get tags for a specific unit
  .get(
    "/for-unit/:unitId",
    async ({ params }): Promise<{ tags: UnitTagDTO[] }> => {
      const unitTags = await tagService.getTagsForUnit(params.unitId);
      return {
        tags: unitTags.map((ut) => mapUnitTagToDTO(ut)),
      };
    },
    {
      params: tagParamsSchema,
      detail: {
        summary: "Get tags for a unit",
        description: "Get all scored tags attached to a specific unit",
        tags: ["Tags"],
      },
    },
  );
