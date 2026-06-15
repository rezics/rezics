import { t } from "elysia";
import { bookDTOSchema, type BookDTO } from "../book/book";
import { postDTOSchema } from "../post/post";
import { shelfDTOSchema, type ShelfDTO } from "../shelf/shelf";
import { unitDTOSchema, type UnitDTO } from "../unit/unit";

/**
 * Stream rows are heterogeneous ordered-list envelopes. They own row identity,
 * cursor/rank metadata, navigation, and dispatch; they do not redefine content
 * payloads or aggregate optional interaction state such as reactions.
 *
 * Stream row 是异构有序列表的 envelope。它只拥有行身份、cursor/rank 元数据、
 * 导航与分发；不重定义内容 payload，也不聚合 reaction 这类可批量补水状态。
 */
export const streamPostRowSchema = t.Object({
  type: t.Literal("post"),
  rowId: t.String(),
  post: postDTOSchema,
  href: t.String(),
  contextUnitId: t.Nullable(t.String()),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamPostRow = (typeof streamPostRowSchema)["static"];

export const streamBookRowSchema = t.Object({
  type: t.Literal("book"),
  rowId: t.String(),
  book: bookDTOSchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamBookRow = Omit<
  (typeof streamBookRowSchema)["static"],
  "book"
> & {
  book: BookDTO;
};

export const streamShelfRowSchema = t.Object({
  type: t.Literal("shelf"),
  rowId: t.String(),
  shelf: shelfDTOSchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamShelfRow = Omit<
  (typeof streamShelfRowSchema)["static"],
  "shelf"
> & {
  shelf: ShelfDTO;
};

export const streamUnitRowSchema = t.Object({
  type: t.Literal("unit"),
  rowId: t.String(),
  unit: unitDTOSchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamUnitRow = Omit<
  (typeof streamUnitRowSchema)["static"],
  "unit"
> & {
  unit: UnitDTO;
};

export const streamRowSchema = t.Union([
  streamPostRowSchema,
  streamBookRowSchema,
  streamShelfRowSchema,
  streamUnitRowSchema,
]);

export type StreamRow = (typeof streamRowSchema)["static"];
