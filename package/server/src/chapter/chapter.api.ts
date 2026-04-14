import {
  type ChapterListResponse,
  type ChapterResponse,
  type CreateChapterInput,
  chapterListQuerySchema,
  chapterParamsSchema,
  createChapterSchema,
  hasPermissionToDeleteChapter,
  hasPermissionToUpdateChapter,
  updateChapterSchema,
} from "@rezics/contract";
import { Elysia, status } from "elysia";
import { authMacro, verifyAdminFromDb } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { chapterService } from "./chapter.service";
import {
  mapUnitToChapterDetailDTO,
  mapUnitToChapterListItemDTO,
} from "./mapper";

export const chapterApi = new Elysia({ prefix: "/chapters" })
  .use(authMacro)
  .get(
    "/:unitId",
    async ({ params }): Promise<ChapterResponse> => {
      const unit = await chapterService.getByUnitId(params.unitId);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      params: chapterParamsSchema,
      detail: {
        summary: "Get chapter",
        description: "Get a single chapter unit by unit ID",
        tags: ["Chapters"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<ChapterResponse> => {
      const req: CreateChapterInput = {
        userId: identity.unitId,
        title: body.title,
        content: body.content,
        targetUnitId: body.targetUnitId,
        metadata: body.metadata,
        status: body.status,
      };
      const unit = await chapterService.create(req);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      requireLogin: true,
      body: createChapterSchema,
      detail: {
        summary: "Create chapter",
        description: "Create a new chapter unit (CHAPTER)",
        tags: ["Chapters"],
      },
    },
  )
  .get(
    "/",
    async ({ identity, query }): Promise<ChapterListResponse> => {
      if (identity.role !== "ADMIN" && identity.role !== "ROOT") {
        return status(403, "Forbidden: Admin role required");
      }
      const isAdmin = await verifyAdminFromDb(identity.unitId);
      if (!isAdmin) return status(403, "Forbidden: Admin role required");

      const { items, total } = await chapterService.list(query);
      return {
        items: items.map(mapUnitToChapterListItemDTO),
        total,
      };
    },
    {
      requireLogin: true,
      query: chapterListQuerySchema,
      detail: {
        summary: "List chapters",
        description:
          "List chapter units with advanced filters (search, tags, status, targetUnitId, user, time range) and pagination",
        tags: ["Chapters"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<ChapterResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (!hasPermissionToUpdateChapter(identity, target as any)) {
        set.status = 403;
        throw new Error("Forbidden: you do not have permission to update");
      }
      const unit = await chapterService.update(params.unitId, body);
      return mapUnitToChapterDetailDTO(unit);
    },
    {
      requireLogin: true,
      params: chapterParamsSchema,
      body: updateChapterSchema,
      detail: {
        summary: "Update chapter",
        description: "Update an existing chapter (by unit ID)",
        tags: ["Chapters"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Chapter not found: ${params.unitId}`);
      }
      if (!hasPermissionToDeleteChapter(identity, target as any)) {
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
