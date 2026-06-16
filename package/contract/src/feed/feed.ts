import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { readLanguageGetQueryBase } from "../list-query-base";
import { moderationStatusSchema } from "../realm/governance";
import {
  streamBookRowSchema,
  streamCreditSummarySchema,
  streamPostRowSchema,
  streamRowSchema,
  streamShelfRowSchema,
  streamTagSummarySchema,
  streamUnitRowSchema,
  streamUnitSummarySchema,
  streamWorkSummarySchema,
  type StreamBookRow,
  type StreamCreditSummary,
  type StreamPostRow,
  type StreamRow,
  type StreamShelfRow,
  type StreamTagSummary,
  type StreamUnitRow,
  type StreamUnitSummary,
  type StreamWorkSummary,
} from "../stream/stream";

export const feedScopeSchema = t.Union([
  t.Literal("home"),
  t.Literal("realm"),
  t.Literal("zone"),
  t.Literal("library"),
]);

export type FeedScope = (typeof feedScopeSchema)["static"];

export const feedSortSchema = t.Union([
  t.Literal("best"),
  t.Literal("hot"),
  t.Literal("new"),
  t.Literal("top"),
  t.Literal("rising"),
]);

export type FeedSort = (typeof feedSortSchema)["static"];

export const feedFilterTypeSchema = t.Union([
  t.Literal("all"),
  t.Literal("book"),
  t.Literal("game"),
  t.Literal("media"),
  t.Literal("post"),
  t.Literal("review"),
  t.Literal("realm"),
  t.Literal("zone"),
]);

export type FeedFilterType = (typeof feedFilterTypeSchema)["static"];

export const feedCursorSchema = t.Object({
  rowId: t.String(),
  sortValue: t.Optional(t.Union([t.Number(), t.String()])),
  createdAt: t.Optional(t.String()),
});

export type FeedCursor = (typeof feedCursorSchema)["static"];

export const feedQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  scope: t.Optional(feedScopeSchema),
  realmUnitId: t.Optional(t.String()),
  zoneUnitId: t.Optional(t.String()),
  libraryKind: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
  tagIds: t.Optional(t.Array(t.String())),
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  languages: t.Optional(t.Union([t.String(), t.Array(contentLanguageSchema)])),
  sort: t.Optional(feedSortSchema),
  filterType: t.Optional(feedFilterTypeSchema),
  cursor: t.Optional(feedCursorSchema),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
});

export type FeedQuery = (typeof feedQuerySchema)["static"];

export const feedTitleSchema = t.Object({
  key: t.String(),
  params: t.Optional(t.Record(t.String(), t.String())),
});

export const feedCreditSummarySchema = streamCreditSummarySchema;

export type FeedCreditSummary = StreamCreditSummary;

export const feedTagSummarySchema = streamTagSummarySchema;

export type FeedTagSummary = StreamTagSummary;

export const feedWorkSummarySchema = streamWorkSummarySchema;

export type FeedWorkSummary = StreamWorkSummary;

export const feedUnitSummarySchema = streamUnitSummarySchema;

export type FeedUnitSummary = StreamUnitSummary;

export const feedPostRowSchema = streamPostRowSchema;

export type FeedPostRow = StreamPostRow;

export const feedBookRowSchema = streamBookRowSchema;

export type FeedBookRow = StreamBookRow;

export const feedShelfRowSchema = streamShelfRowSchema;

export type FeedShelfRow = StreamShelfRow;

export const feedUnitRowSchema = streamUnitRowSchema;

export type FeedUnitRow = StreamUnitRow;

export const feedRowSchema = streamRowSchema;

export type FeedRow = StreamRow;

export const feedResponseSchema = t.Object({
  scope: feedScopeSchema,
  sort: feedSortSchema,
  rows: t.Array(feedRowSchema),
  nextCursor: t.Optional(t.Nullable(feedCursorSchema)),
});

export type FeedResponse = (typeof feedResponseSchema)["static"];
