import { t } from "elysia";
import { publicUserSchema, unitTranslationDTOSchema } from "./unit";

// ============================================================
// SHELF ITEM DTO
// ============================================================

export const shelfItemDTOSchema = t.Object({
  shelfUnitId: t.String(),
  itemUnitId: t.String(),
  sortOrder: t.Number(),
  reviewPostUnitId: t.Optional(t.Nullable(t.String())),
  label: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ShelfItemDTO = (typeof shelfItemDTOSchema)["static"];

// ============================================================
// SHELF DTO
// ============================================================

export const shelfDTOSchema = t.Object({
  unitId: t.String(),
  userId: t.Optional(t.Nullable(t.String())),
  user: t.Optional(publicUserSchema),
  kindKey: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(t.Array(unitTranslationDTOSchema)),
  items: t.Optional(t.Array(shelfItemDTOSchema)),
  reactionSummaries: t.Optional(t.Any()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type ShelfDTO = (typeof shelfDTOSchema)["static"];

// ============================================================
// SHELF LIST/QUERY
// ============================================================

export const shelfListQuerySchema = t.Object({
  userId: t.Optional(t.String()),
  kindKey: t.Optional(t.String()),
  containsItemUnitId: t.Optional(t.String()),
  language: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type ShelfListQuery = (typeof shelfListQuerySchema)["static"];

export const shelfListResponseSchema = t.Object({
  shelves: t.Array(shelfDTOSchema),
  total: t.Optional(t.Number()),
});

export type ShelfListResponse = (typeof shelfListResponseSchema)["static"];

// ============================================================
// SHELF PARAMS/RESPONSE
// ============================================================

export const shelfParamsSchema = t.Object({
  unitId: t.String(),
});

export type ShelfParams = (typeof shelfParamsSchema)["static"];

export const shelfResponseSchema = shelfDTOSchema;
export type ShelfResponse = (typeof shelfResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE SHELF
// ============================================================

export const createShelfSchema = t.Object({
  kindKey: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  translations: t.Optional(
    t.Array(
      t.Object({
        language: t.String(),
        title: t.Optional(t.String()),
        subtitle: t.Optional(t.String()),
        summary: t.Optional(t.String()),
        description: t.Optional(t.String()),
      }),
    ),
  ),
});

export type CreateShelfInput = (typeof createShelfSchema)["static"];

export const updateShelfSchema = t.Object({
  kindKey: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateShelfInput = (typeof updateShelfSchema)["static"];

// ============================================================
// SHELF ITEM CRUD
// ============================================================

export const addShelfItemSchema = t.Object({
  itemUnitId: t.String(),
  sortOrder: t.Optional(t.Number()),
  reviewPostUnitId: t.Optional(t.String()),
  label: t.Optional(t.String()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type AddShelfItemInput = (typeof addShelfItemSchema)["static"];

export const updateShelfItemSchema = t.Object({
  sortOrder: t.Optional(t.Number()),
  reviewPostUnitId: t.Optional(t.Nullable(t.String())),
  label: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdateShelfItemInput = (typeof updateShelfItemSchema)["static"];

export const shelfItemParamsSchema = t.Object({
  shelfUnitId: t.String(),
  itemUnitId: t.String(),
});

export type ShelfItemParams = (typeof shelfItemParamsSchema)["static"];
