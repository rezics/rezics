import type {
  EnsureSystemShelfResponse,
  SetPinnedTagsResponse,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfListResponse,
  ShelfSummaryDTO,
  ShelfUnitBatchResponse,
  ShelfUnitDTO,
  ShelfUnitRelationDTO,
  ShelfUnitsResponse,
} from "@rezics/contract";
import {
  addShelfUnitSchema,
  attachReviewSchema,
  cleanupShelfOrphansSchema,
  createShelfSchema,
  ensureSystemShelfBodySchema,
  hasAmbiguousShelfListScopeFilters,
  hasPermissionToDeleteShelf,
  hasPermissionToUpdateShelf,
  reorderShelfUnitSchema,
  setPinnedTagsBodySchema,
  setShelfUnitChildrenSchema,
  shelfBySlugParamsSchema,
  shelfListBodySchema,
  shelfListQuerySchema,
  shelfParamsSchema,
  shelfUnitBatchRequestSchema,
  shelfUnitsQuerySchema,
  updateShelfSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, tryResolveIdentity } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { userService } from "@/user/service/user.service";
import { AppError } from "@/utils/errors";
import { shelfService } from "./shelf.service";
import { ensureSystemShelf } from "./system-shelves";

const shelfUnitRouteParamsSchema = t.Object({
  unitId: t.String(),
  shelfUnitId: t.String(),
});

const reviewDetachParamsSchema = t.Object({
  unitId: t.String(),
  shelfUnitId: t.String(),
  reviewUnitId: t.String(),
});

const childrenRouteParamsSchema = t.Object({
  unitId: t.String(),
  shelfUnitId: t.String(),
});

export const shelfApi = new Elysia({ prefix: "/shelf" })
  .use(authMacro)
  // --- Shelf CRUD ---
  .get(
    "/me",
    async ({ identity }): Promise<ShelfSummaryDTO[]> => {
      return shelfService.listUserShelves(identity.userId);
    },
    {
      requireLogin: true,
      detail: {
        summary: "List my shelves",
        description:
          "List the current user's shelves with item counts and tags (for collection modal)",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/system/ensure",
    async ({ body, identity }): Promise<EnsureSystemShelfResponse> => {
      const user = await userService.getByUserId(identity.userId);
      if (!user.slug) {
        throw new AppError(
          409,
          "Caller has no slug; cannot ensure system shelf",
        );
      }
      const { unitId, created } = await ensureSystemShelf(
        identity.userId,
        user.slug,
        body.kindKey,
      );
      return { unitId, created };
    },
    {
      requireLogin: true,
      body: ensureSystemShelfBodySchema,
      parse: async ({ request }) => {
        const text = await request.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AppError(400, "Invalid JSON body", {
            code: "invalid_body",
          });
        }
        if (
          parsed === null ||
          typeof parsed !== "object" ||
          Array.isArray(parsed)
        ) {
          throw new AppError(400, "Body must be a JSON object", {
            code: "invalid_body",
          });
        }
        const extraneousKeys = Object.keys(parsed).filter(
          (k) => k !== "kindKey",
        );
        if (extraneousKeys.length > 0) {
          throw new AppError(
            400,
            `Unexpected body field(s): ${extraneousKeys.join(", ")}`,
            { code: "invalid_body" },
          );
        }
        return parsed;
      },
      detail: {
        summary: "Ensure a system shelf exists",
        description:
          "Idempotent recovery path for users in an inconsistent post-registration state (missing system shelf). Always creates with visibility=PRIVATE and DB title `${slug}'s ${Label}`. No automatic retry; user-driven only.",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/by-slug/:userSlug/:slug",
    async ({ params, set }) => {
      const owner = await userService.getBySlug(params.userSlug);
      if (!owner) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "User not found" } };
      }
      const shelf = await shelfService.getByOwnerAndSlug(
        owner.unitId,
        params.slug,
      );
      if (!shelf) {
        set.status = 404;
        return { error: { code: "NOT_FOUND", message: "Shelf not found" } };
      }
      return shelf;
    },
    {
      params: shelfBySlugParamsSchema,
      detail: {
        summary: "Get shelf by slug",
        description:
          "Resolve owner by userSlug then a SHELF Unit under the owner scope. Returns 404 for any non-system shelf slug in v1.",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/:unitId",
    async ({ params }): Promise<ShelfDetailDTO> => {
      return shelfService.getByUnitId(params.unitId);
    },
    {
      params: shelfParamsSchema,
      detail: {
        summary: "Get shelf",
        description: "Get a single shelf with metadata",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/list",
    async ({ query }): Promise<ShelfListResponse> => {
      if (hasAmbiguousShelfListScopeFilters(query)) {
        throw new AppError(400, "ambiguous-shelf-containment-filter");
      }
      const { shelves, total } = await shelfService.list(query as any);
      return { shelves, total };
    },
    {
      query: shelfListQuerySchema,
      detail: {
        summary: "List shelves",
        description: "List shelves with filtering and pagination",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/list",
    async ({ body }): Promise<ShelfListResponse> => {
      if (hasAmbiguousShelfListScopeFilters(body)) {
        throw new AppError(400, "ambiguous-shelf-containment-filter");
      }
      const { shelves, total } = await shelfService.list({
        ...body,
        ids: body.ids?.join(","),
      } as any);
      return { shelves, total };
    },
    {
      body: shelfListBodySchema,
      detail: {
        summary: "List shelves (POST)",
        description:
          "List shelves via POST body. Use when ids exceed URL length or filters contain nested objects.",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/",
    async ({ body, identity }): Promise<ShelfDTO> => {
      return shelfService.create(body, identity.userId);
    },
    {
      requireLogin: true,
      body: createShelfSchema,
      detail: {
        summary: "Create shelf",
        description: "Create a new shelf",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId",
    async ({ params, body, identity, set }): Promise<ShelfDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Shelf not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this shelf",
        );
      }
      return shelfService.update(params.unitId, body);
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: updateShelfSchema,
      detail: {
        summary: "Update shelf",
        description: "Update an existing shelf by unit ID",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId/pinned-tags",
    async ({ params, body, identity, set }): Promise<SetPinnedTagsResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!target) {
        set.status = 404;
        throw new Error(`Shelf not found: ${params.unitId}`);
      }
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to update this shelf",
        );
      }
      return shelfService.setPinnedTags(
        params.unitId,
        body.pinnedTagIds,
        identity.userId,
      );
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: setPinnedTagsBodySchema,
      detail: {
        summary: "Set shelf pinned seed tags",
        description:
          "Replace the shelf's set of pinned seed-tag UnitTag rows. Only seed-tag UUIDs are accepted; non-seed identifiers are rejected.",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToDeleteShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to delete this shelf",
        );
      }
      await shelfService.delete(params.unitId);
      return { message: "Shelf deleted successfully" };
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      detail: {
        summary: "Delete shelf",
        description: "Delete a shelf by unit ID",
        tags: ["Shelves"],
      },
    },
  )
  // --- Shelf unit routes ---
  .get(
    "/:unitId/units",
    async ({ headers, params, query }): Promise<ShelfUnitsResponse> => {
      const identity = await tryResolveIdentity(
        headers["authorization"],
        headers["cookie"],
      );
      return shelfService.getShelfUnits(params.unitId, query, {
        viewerUserId: identity?.userId,
      });
    },
    {
      params: shelfParamsSchema,
      query: shelfUnitsQuerySchema,
      detail: {
        summary: "List shelf units",
        description:
          "List ShelfUnit rows in a shelf in position order with cursor pagination; includes relevant ShelfUnitRelation rows.",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/units",
    async ({ params, body, identity, set }): Promise<ShelfUnitDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.addUnit(params.unitId, body, identity.userId);
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: addShelfUnitSchema,
      detail: {
        summary: "Add unit to shelf",
        description: "Create a ShelfUnit row in the shelf",
        tags: ["Shelves"],
      },
    },
  )
  .patch(
    "/:unitId/units/:shelfUnitId/position",
    async ({ params, body, identity, set }): Promise<ShelfUnitDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.reorderUnit(params.unitId, params.shelfUnitId, body);
    },
    {
      requireLogin: true,
      params: shelfUnitRouteParamsSchema,
      body: reorderShelfUnitSchema,
      detail: {
        summary: "Reorder shelf unit",
        description:
          "Move a shelf unit between neighbor unit ids; server computes a fractional-index position",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/units/:shelfUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.removeUnit(params.unitId, params.shelfUnitId);
      return { message: "Unit removed from shelf" };
    },
    {
      requireLogin: true,
      params: shelfUnitRouteParamsSchema,
      detail: {
        summary: "Remove unit from shelf",
        description: "Delete a ShelfUnit row from a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/units/:shelfUnitId/reviews",
    async ({ params, body, identity, set }): Promise<ShelfUnitRelationDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.attachReview(
        params.unitId,
        params.shelfUnitId,
        body.reviewUnitId,
      );
    },
    {
      requireLogin: true,
      params: childrenRouteParamsSchema,
      body: attachReviewSchema,
      detail: {
        summary: "Attach review to a shelf unit",
        description:
          "Create role='review' ShelfUnitRelation; auto-creates the child ShelfUnit if missing.",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/units/:shelfUnitId/reviews/:reviewUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.detachReview(
        params.unitId,
        params.shelfUnitId,
        params.reviewUnitId,
      );
      return { message: "Review detached" };
    },
    {
      requireLogin: true,
      params: reviewDetachParamsSchema,
      detail: {
        summary: "Detach review from a shelf unit",
        description: "Delete a role='review' ShelfUnitRelation row.",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId/units/:shelfUnitId/children",
    async ({ params, body, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.setChildren(
        params.unitId,
        params.shelfUnitId,
        body.role,
        body.childUnitIds,
      );
      return { message: "Children reconciled" };
    },
    {
      requireLogin: true,
      params: childrenRouteParamsSchema,
      body: setShelfUnitChildrenSchema,
      detail: {
        summary: "Reconcile children for a parent role",
        description:
          "Replace the set of ShelfUnitRelation rows for (parent, role) to exactly the supplied child unit ids; auto-creates missing child ShelfUnit rows.",
        tags: ["Shelves"],
      },
    },
  )
  .patch(
    "/:unitId/units/batch",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<ShelfUnitBatchResponse> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      const results = await shelfService.applyBatch(params.unitId, body.ops);
      return { results };
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: shelfUnitBatchRequestSchema,
      detail: {
        summary: "Apply a batch of shelf unit ops",
        description:
          "Apply an ordered op log of add/reorder/reorderToPage/delete/attach/detach/setChildren ops in a single transaction. Returns per-op results.",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/cleanup",
    async ({ params, body, identity, set }): Promise<{ deleted: number }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (
        !hasPermissionToUpdateShelf(
          identity.permission,
          identity.userId,
          target as any,
        )
      ) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.cleanupOrphans(params.unitId, body.orphanUnitIds);
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: cleanupShelfOrphansSchema,
      detail: {
        summary: "Cleanup orphan shelf units",
        description:
          "Delete ShelfUnit rows whose target units no longer exist (author-driven)",
        tags: ["Shelves"],
      },
    },
  );

export default shelfApi;
