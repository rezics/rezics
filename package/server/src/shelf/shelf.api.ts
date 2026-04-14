import type {
  ShelfDTO,
  ShelfDetailDTO,
  ShelfItemDTO,
  ShelfListResponse,
  ShelfSummaryDTO,
} from "@rezics/contract";
import {
  addShelfItemSchema,
  createShelfSchema,
  hasPermissionToDeleteShelf,
  hasPermissionToUpdateShelf,
  reorderShelfItemsSchema,
  shelfItemsQuerySchema,
  shelfListQuerySchema,
  shelfParamsSchema,
  updateShelfItemSchema,
  updateShelfSchema,
} from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro } from "@/middleware";
import { unitService } from "@/unit/unit.service";
import { shelfService } from "./shelf.service";

export const shelfApi = new Elysia({ prefix: "/shelves" })
  .use(authMacro)
  // --- Shelf CRUD ---
  .get(
    "/me",
    async ({ identity }): Promise<ShelfSummaryDTO[]> => {
      return shelfService.listUserShelves(identity.unitId);
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
    "/",
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
    "/",
    async ({ body, identity }): Promise<ShelfDTO> => {
      return shelfService.create(body, identity.unitId);
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
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
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
      if (!hasPermissionToDeleteShelf(identity, target as any)) {
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
    async ({ params, query, identity }) => {
      return shelfService.getShelfItems(
        params.unitId,
        identity.unitId,
        query as any,
      );
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      query: shelfItemsQuerySchema,
      detail: {
        summary: "List shelf items",
        description:
          "List items in a shelf with filtering by keyword, created/collected, and pagination",
        tags: ["Shelves"],
      },
    },
  )
  .post(
    "/:unitId/items",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
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
    "/:unitId/items/:itemUnitId",
    async ({ params, body, identity, set }): Promise<ShelfItemDTO> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      return shelfService.updateItem(
        params.unitId,
        params.itemUnitId,
        body,
      );
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), itemUnitId: t.String() }),
      body: updateShelfItemSchema,
      detail: {
        summary: "Update shelf item",
        description: "Update an item within a shelf (keywords, label, sortOrder)",
        tags: ["Shelves"],
      },
    },
  )
  .put(
    "/:unitId/items/reorder",
    async ({ params, body, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.reorderItems(params.unitId, body);
      return { message: "Items reordered" };
    },
    {
      requireLogin: true,
      params: shelfParamsSchema,
      body: reorderShelfItemsSchema,
      detail: {
        summary: "Reorder shelf items",
        description: "Batch update sort order for items in a shelf",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/items/:itemUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.removeItem(params.unitId, params.itemUnitId);
      return { message: "Item removed from shelf" };
    },
    {
      requireLogin: true,
      params: t.Object({ unitId: t.String(), itemUnitId: t.String() }),
      detail: {
        summary: "Remove item from shelf",
        description: "Remove an item from a shelf (cascades ShelfItemReviews)",
        tags: ["Shelves"],
      },
    },
  )
  .delete(
    "/:unitId/items/:itemUnitId/reviews/:reviewUnitId",
    async ({ params, identity, set }): Promise<{ message: string }> => {
      const target = await unitService.getByUnitId(params.unitId);
      if (!hasPermissionToUpdateShelf(identity, target as any)) {
        set.status = 403;
        throw new Error(
          "Forbidden: you do not have permission to modify this shelf",
        );
      }
      await shelfService.detachReview(
        params.unitId,
        params.itemUnitId,
        params.reviewUnitId,
      );
      return { message: "Review detached from shelf item" };
    },
    {
      requireLogin: true,
      params: t.Object({
        unitId: t.String(),
        itemUnitId: t.String(),
        reviewUnitId: t.String(),
      }),
      detail: {
        summary: "Detach review from shelf item",
        description: "Remove a single review attachment from a shelf item",
        tags: ["Shelves"],
      },
    },
  );

export default shelfApi;
