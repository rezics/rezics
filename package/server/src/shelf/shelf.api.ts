import type {
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemBatchResponse,
  ShelfItemDTO,
  ShelfListResponse,
  ShelfSummaryDTO,
} from "@rezics/contract";
import {
  addShelfItemSchema,
  attachReviewSchema,
  cleanupShelfOrphansSchema,
  createShelfSchema,
  hasPermissionToDeleteShelf,
  hasPermissionToUpdateShelf,
  reorderShelfItemSchema,
  setShelfItemTagsSchema,
  shelfItemBatchRequestSchema,
  shelfItemsQuerySchema,
  shelfListBodySchema,
  shelfListQuerySchema,
  shelfParamsSchema,
  updateShelfSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { shelfService } from "./shelf.service";

const itemParamsSchema = t.Object({
  unitId: t.String(),
  itemRef: t.String(),
});

const reviewDetachParamsSchema = t.Object({
  unitId: t.String(),
  itemRef: t.String(),
  reviewUnitId: t.String(),
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
  .get(
    "/:unitId",
    async ({ params }): Promise<ShelfDetailDTO> => {
      return shelfService.getByUnitId(params.unitId);
    },
    {
      params: shelfParamsSchema,
      detail: {
        summary: "Get shelf",
        description: "Get a single shelf with metadata and first page of items",
        tags: ["Shelves"],
      },
    },
  )
  .get(
    "/list",
    async ({ query }): Promise<ShelfListResponse> => {
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
  // --- Shelf item routes ---
  .get(
    "/:unitId/items",
    async ({ params, query }) => {
      return shelfService.getShelfItems(params.unitId, query);
    },
    {
      params: shelfParamsSchema,
      query: shelfItemsQuerySchema,
      detail: {
        summary: "List shelf items",
        description:
          "List items in a shelf in position order with cursor pagination",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/items",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
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
      return shelfService.addItem(params.unitId, body);
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: addShelfItemSchema,
      detail: {
        summary: "Add item to shelf",
        description: "Add an item to a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .patch(
    "/:unitId/items/:itemRef/position",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
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
      return shelfService.reorderItem(params.unitId, params.itemRef, body);
    },
    {
      requireLogin: true,
      params: itemParamsSchema,
      body: reorderShelfItemSchema,
      detail: {
        summary: "Reorder shelf item",
        description:
          "Move a shelf item between neighbor refs; server computes a fractional-index position",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/items/:itemRef",
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
      await shelfService.removeItem(params.unitId, params.itemRef);
      return { message: "Item removed from shelf" };
    },
    {
      requireLogin: true,
      params: itemParamsSchema,
      detail: {
        summary: "Remove item from shelf",
        description: "Remove an item from a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/items/:itemRef/reviews",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
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
        params.itemRef,
        body.reviewUnitId,
      );
    },
    {
      requireLogin: true,
      params: itemParamsSchema,
      body: attachReviewSchema,
      detail: {
        summary: "Attach review to shelf item",
        description:
          "Insert a role='review' ShelfItemUnit row bound to the slot (creates the slot if needed)",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/items/:itemRef/reviews/:reviewUnitId",
    async ({ params, identity, set }): Promise<ShelfItemDTO> => {
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
      return shelfService.detachReview(
        params.unitId,
        params.itemRef,
        params.reviewUnitId,
      );
    },
    {
      requireLogin: true,
      params: reviewDetachParamsSchema,
      detail: {
        summary: "Detach review from shelf item",
        description: "Remove a single review attachment from a shelf item",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId/items/:itemRef/tags",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
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
      return shelfService.setItemTags(
        params.unitId,
        params.itemRef,
        body.tagIds,
      );
    },
    {
      requireLogin: true,
      params: itemParamsSchema,
      body: setShelfItemTagsSchema,
      detail: {
        summary: "Set shelf item tags",
        description: "Replace the tagIds array on a shelf item",
        tags: ["Shelves"],
      },
    },
  )
  .patch(
    "/:unitId/items/batch",
    async ({
      params,
      body,
      identity,
      set,
    }): Promise<ShelfItemBatchResponse> => {
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
      body: shelfItemBatchRequestSchema,
      detail: {
        summary: "Apply a batch of shelf item ops",
        description:
          "Apply an ordered op log of add/reorder/reorderToPage/delete/setTags ops in a single transaction. Returns per-op results.",
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
      return shelfService.cleanupOrphans(params.unitId, body.orphanItemRefs);
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: cleanupShelfOrphansSchema,
      detail: {
        summary: "Cleanup orphan shelf items",
        description:
          "Delete shelf items whose target units no longer exist (author-driven)",
        tags: ["Shelves"],
      },
    },
  );

export default shelfApi;
