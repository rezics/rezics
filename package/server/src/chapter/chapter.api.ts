import {
  chapterMaterializationRequestSchema,
  chapterMaterializationResponseSchema,
  chapterMaterializeByBookPathParamsSchema,
  chapterListBodySchema,
  chapterListQuerySchema,
  chapterListResponseSchema,
  chapterParamsSchema,
  chapterResponseSchema,
  createChapterSchema,
  hasPermissionToUpdateBook,
  hasPermissionToDeleteChapter,
  hasPermissionToUpdateChapter,
  updateChapterSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { chapterService } from "./chapter.service";
import {
  mapChapterPostToDetailDTO,
  mapChapterPostToListItemDTO,
} from "./mapper";

export const chapterApi = new Elysia({ prefix: "/chapter" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }) => {
      const post = await chapterService.getByUnitId(params.unitId);
      return mapChapterPostToDetailDTO(post);
    },
    {
      params: chapterParamsSchema,
      response: chapterResponseSchema,
      detail: {
        summary: "Get chapter",
        description: "Get a single chapter unit by unit ID",
        tags: ["Chapters"],
      },
    },
  )
  .post(
    "/materialize/book/:bookUnitId",
    async ({ params, body, identity, set }) => {
      const targetBookUnit = await unitService.getByUnitId(params.bookUnitId);
      if (!targetBookUnit) {
        set.status = 404;
        throw new Error(`Book not found: ${params.bookUnitId}`);
      }
      if (
        !hasPermissionToUpdateBook(
          identity.permission,
          identity.userId,
          undefined,
          targetBookUnit as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to materialize chapters",
        );
      }

      try {
        return await chapterService.materializeByBookPath(
          params.bookUnitId,
          body,
          identity.userId,
        );
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Conflict:")) {
          set.status = 409;
        }
        throw error;
      }
    },
    {
      requireLogin: true,
      params: chapterMaterializeByBookPathParamsSchema,
      body: chapterMaterializationRequestSchema,
      response: {
        200: chapterMaterializationResponseSchema,
      },
      detail: {
        summary: "Materialize chapter by BookContentStructure path",
        description:
          "Create or return the materialized chapter Unit for a BookContentStructure path",
        tags: ["Chapters"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }) => {
      const post = await chapterService.create({
        userId: identity.userId,
        title: body.title,
        content: body.content,
        targetUnitId: body.targetUnitId,
        coverUrl: body.coverUrl,
        status: body.status,
      });
      return mapChapterPostToDetailDTO(post);
    },
    {
      requireLogin: true,
      body: createChapterSchema,
      response: chapterResponseSchema,
      detail: {
        summary: "Create chapter",
        description: "Create a new chapter unit (CHAPTER)",
        tags: ["Chapters"],
      },
    },
  )
  .get(
    "/list",
    async ({ identity, query, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { items, total } = await chapterService.list(query);
      return {
        items: items.map(mapChapterPostToListItemDTO),
        total,
      };
    },
    {
      requireLogin: true,
      query: chapterListQuerySchema,
      response: {
        200: chapterListResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "List chapters",
        description:
          "List chapter units with advanced filters (search, tags, status, targetUnitId, user, time range) and pagination",
        tags: ["Chapters"],
      },
    },
  )
  .post(
    "/list",
    async ({ identity, body, status }) => {
      if (
        identity.permission.role !== "ADMIN" &&
        identity.permission.role !== "ROOT"
      ) {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.userId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { items, total } = await chapterService.list({
        ...body,
        ids: body.ids?.join(","),
      });
      return {
        items: items.map(mapChapterPostToListItemDTO),
        total,
      };
    },
    {
      requireLogin: true,
      body: chapterListBodySchema,
      response: {
        200: chapterListResponseSchema,
        403: t.String(),
      },
      detail: {
        summary: "List chapters (POST)",
        description:
          "List chapters via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Chapters"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }) => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateChapter(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not have permission to update");
      }
      const post = await chapterService.update(params.unitId, body);
      return mapChapterPostToDetailDTO(post);
    },
    {
      requireLogin: true,
      params: chapterParamsSchema,
      body: updateChapterSchema,
      response: chapterResponseSchema,
      detail: {
        summary: "Update chapter",
        description: "Update an existing chapter (by unit ID)",
        tags: ["Chapters"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }) => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToDeleteChapter(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error("Forbidden: you do not have permission to delete");
      }
      await chapterService.delete(params.unitId);
      return { message: "Chapter deleted successfully" };
    },
    {
      requireLogin: true,
      params: chapterParamsSchema,
      detail: {
        summary: "Delete chapter",
        description: "Delete a chapter unit by unit ID",
        tags: ["Chapters"],
      },
    },
  );
