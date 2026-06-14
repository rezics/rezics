import { t } from "elysia";
import { postDTOSchema } from "../post/post";
import { shelfSummaryDTOSchema } from "../shelf/shelf";
import { unitTypeSchema, variantContextSummarySchema } from "../unit/unit";

export const streamCreditSummarySchema = t.Object({
  unitId: t.String(),
  name: t.String(),
  role: t.Optional(t.String()),
});

export type StreamCreditSummary = (typeof streamCreditSummarySchema)["static"];

export const streamTagSummarySchema = t.Object({
  unitId: t.String(),
  label: t.String(),
  slug: t.Optional(t.Nullable(t.String())),
});

export type StreamTagSummary = (typeof streamTagSummarySchema)["static"];

export const streamWorkSummarySchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.String()),
  title: t.Optional(t.Nullable(t.String())),
  subtitle: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  primaryAuthor: t.Optional(t.Nullable(streamCreditSummarySchema)),
  tags: t.Optional(t.Array(streamTagSummarySchema)),
});

export type StreamWorkSummary = (typeof streamWorkSummarySchema)["static"];

export const streamUnitSummarySchema = t.Object({
  unitId: t.String(),
  type: unitTypeSchema,
  slug: t.Optional(t.Nullable(t.String())),
  title: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type StreamUnitSummary = (typeof streamUnitSummarySchema)["static"];

export const streamPostRowSchema = t.Object({
  type: t.Literal("post"),
  rowId: t.String(),
  post: postDTOSchema,
  href: t.String(),
  contextUnitId: t.Nullable(t.String()),
  realm: t.Optional(
    t.Nullable(
      t.Object({
        unitId: t.String(),
        slug: t.Optional(t.Nullable(t.String())),
        title: t.Optional(t.Nullable(t.String())),
      }),
    ),
  ),
  targetUnit: t.Optional(t.Nullable(streamWorkSummarySchema)),
  variantContext: t.Optional(t.Nullable(variantContextSummarySchema)),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamPostRow = (typeof streamPostRowSchema)["static"];

export const streamBookRowSchema = t.Object({
  type: t.Literal("book"),
  rowId: t.String(),
  book: streamWorkSummarySchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamBookRow = (typeof streamBookRowSchema)["static"];

export const streamShelfRowSchema = t.Object({
  type: t.Literal("shelf"),
  rowId: t.String(),
  shelf: shelfSummaryDTOSchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamShelfRow = (typeof streamShelfRowSchema)["static"];

export const streamUnitRowSchema = t.Object({
  type: t.Literal("unit"),
  rowId: t.String(),
  unit: streamUnitSummarySchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type StreamUnitRow = (typeof streamUnitRowSchema)["static"];

export const streamRowSchema = t.Union([
  streamPostRowSchema,
  streamBookRowSchema,
  streamShelfRowSchema,
  streamUnitRowSchema,
]);

export type StreamRow = (typeof streamRowSchema)["static"];
