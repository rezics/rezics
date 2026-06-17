import { t } from "elysia";
import { contentLanguageSchema } from "../language";
import { readLanguageGetQueryBase } from "../list-query-base";
import { moderationStatusSchema } from "../realm/governance";
import { streamRowSchema } from "./stream";

export const streamScopeSchema = t.Union([
  t.Literal("home"),
  t.Literal("realm"),
  t.Literal("zone"),
  t.Literal("library"),
]);

export type StreamScope = (typeof streamScopeSchema)["static"];

export const streamSortSchema = t.Union([
  t.Literal("best"),
  t.Literal("hot"),
  t.Literal("new"),
  t.Literal("top"),
  t.Literal("rising"),
]);

export type StreamSort = (typeof streamSortSchema)["static"];

export const streamFilterTypeSchema = t.Union([
  t.Literal("all"),
  t.Literal("book"),
  t.Literal("game"),
  t.Literal("media"),
  t.Literal("post"),
  t.Literal("review"),
  t.Literal("realm"),
  t.Literal("zone"),
]);

export type StreamFilterType = (typeof streamFilterTypeSchema)["static"];

export const streamCursorSchema = t.Object({
  rowId: t.String(),
  sortValue: t.Optional(t.Union([t.Number(), t.String()])),
  createdAt: t.Optional(t.String()),
});

export type StreamCursor = (typeof streamCursorSchema)["static"];

/**
 * Stream query is reserved for heterogeneous ranked lists: home streams,
 * realm-scoped mixed streams, zone streams, and library recommendation streams.
 * Single-domain lists keep their own APIs and may render with stream cards, but
 * they do not route through this contract just to reuse card UI.
 *
 * Stream query 只用于异构排序流：首页流、realm 混合流、zone 流与 library 推荐流。
 * 单一领域列表保留各自 API；即便使用 stream card 渲染，也不为复用 UI 经过该契约。
 */
export const streamQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  scope: t.Optional(streamScopeSchema),
  realmUnitId: t.Optional(t.String()),
  zoneUnitId: t.Optional(t.String()),
  libraryKind: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
  tagIds: t.Optional(t.Array(t.String())),
  /**
   * Policy-tag source filter for realm/global stream surfaces. This is separate
   * from `tagIds` so ordinary UnitTag/TagVote filters never read policy rows.
   * realm/global 信息流的政策标签来源过滤。它与 `tagIds` 分离，确保普通
   * UnitTag/TagVote 过滤不会读取 policy 行。
   */
  policyTagIds: t.Optional(t.Array(t.String())),
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  languages: t.Optional(t.Union([t.String(), t.Array(contentLanguageSchema)])),
  sort: t.Optional(streamSortSchema),
  filterType: t.Optional(streamFilterTypeSchema),
  cursor: t.Optional(streamCursorSchema),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
});

export type StreamQuery = (typeof streamQuerySchema)["static"];

export const streamTitleSchema = t.Object({
  key: t.String(),
  params: t.Optional(t.Record(t.String(), t.String())),
});

/**
 * Stream responses carry native row payloads. Each row keeps its content DTO
 * under its own key (`post`, `book`, `shelf`, `unit`) so renderers can dispatch
 * directly without a lossy normalized row contract.
 *
 * Stream response 承载原生行 payload。每行保留自己的内容 key（`post`、`book`、
 * `shelf`、`unit`），渲染器可直接分发，不再映射到有损的统一 row contract。
 */
export const streamResponseSchema = t.Object({
  scope: streamScopeSchema,
  sort: streamSortSchema,
  rows: t.Array(streamRowSchema),
  nextCursor: t.Optional(t.Nullable(streamCursorSchema)),
});

export type StreamResponse = (typeof streamResponseSchema)["static"];
