import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware } from "./middlewares/auth.ts";

// -- Response schemas 响应模型 --

export class ContentStructure extends Schema.Class<ContentStructure>("ContentStructure")({
  ownerUnitId: Schema.String,
  tree: Schema.Unknown,
  updatedAt: Schema.DateFromString,
}) {}

export class ContentTranslation extends Schema.Class<ContentTranslation>("ContentTranslation")({
  unitId: Schema.String,
  language: Schema.String,
  body: Schema.Unknown,
  updatedAt: Schema.DateFromString,
}) {}

export class HistoryRevisionEntry extends Schema.Class<HistoryRevisionEntry>("HistoryRevisionEntry")({
  id: Schema.String,
  unitId: Schema.String,
  actorId: Schema.String,
  action: Schema.String,
  timestamp: Schema.DateFromString,
  meta: Schema.optional(Schema.Unknown),
}) {}

export class HistoryComparison extends Schema.Class<HistoryComparison>("HistoryComparison")({
  before: Schema.Unknown,
  after: Schema.Unknown,
  diff: Schema.Unknown,
}) {}

export class HistoryStructureEvent extends Schema.Class<HistoryStructureEvent>("HistoryStructureEvent")({
  id: Schema.String,
  unitId: Schema.String,
  action: Schema.String,
  timestamp: Schema.DateFromString,
  meta: Schema.optional(Schema.Unknown),
}) {}

export class ResolvedActor extends Schema.Class<ResolvedActor>("ResolvedActor")({
  id: Schema.String,
  name: Schema.String,
  image: Schema.NullOr(Schema.String),
}) {}

export class ResolvedUnit extends Schema.Class<ResolvedUnit>("ResolvedUnit")({
  id: Schema.String,
  title: Schema.String,
  kind: Schema.String,
}) {}

// -- Errors 错误 --

export class ContentNotFound extends Schema.TaggedErrorClass<ContentNotFound>()(
  "ContentNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class ContentForbidden extends Schema.TaggedErrorClass<ContentForbidden>()(
  "ContentForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class ContentConflict extends Schema.TaggedErrorClass<ContentConflict>()(
  "ContentConflict",
  {},
  { httpApiStatus: 409 },
) {}

// -- Group 接口组 --

export class ContentGroup extends HttpApiGroup.make("content")
  .add(
    // -- Content structure 内容结构 --
    HttpApiEndpoint.get("getStructure", "/content-structure/:ownerUnitId", {
      params: { ownerUnitId: Schema.String },
      success: ContentStructure,
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.put("putStructure", "/content-structure/:ownerUnitId", {
      params: { ownerUnitId: Schema.String },
      payload: Schema.Struct({
        tree: Schema.Unknown,
      }),
      success: ContentStructure,
      error: [ContentNotFound, ContentForbidden, ContentConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    HttpApiEndpoint.post("restoreStructure", "/content-structure/:ownerUnitId/restore", {
      params: { ownerUnitId: Schema.String },
      success: ContentStructure,
      error: [ContentNotFound, ContentForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -- Content translation 内容翻译 --
    HttpApiEndpoint.get("getTranslation", "/content-translation/:unitId/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      success: ContentTranslation,
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.put("putTranslation", "/content-translation/:unitId/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      payload: Schema.Struct({
        body: Schema.Unknown,
      }),
      success: ContentTranslation,
      error: [ContentNotFound, ContentForbidden, ContentConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    HttpApiEndpoint.delete("deleteTranslation", "/content-translation/:unitId/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [ContentNotFound, ContentForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -- History proxy 历史代理 --
    HttpApiEndpoint.get("listRevisions", "/history/unit/:unitId/revisions", {
      params: { unitId: Schema.String },
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(HistoryRevisionEntry),
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.get("compareRevisions", "/history/unit/:unitId/compare", {
      params: { unitId: Schema.String },
      query: {
        from: Schema.String,
        to: Schema.String,
      },
      success: HistoryComparison,
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.get("getRevision", "/history/unit/:unitId/revision/:revisionId", {
      params: { unitId: Schema.String, revisionId: Schema.String },
      success: HistoryRevisionEntry,
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.get("listStructureEvents", "/history/unit/:unitId/structure-events", {
      params: { unitId: Schema.String },
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(HistoryStructureEvent),
      error: [ContentNotFound, HttpApiError.InternalServerError],
    }),

    // -- History resolution 历史解析 --
    HttpApiEndpoint.post("resolveActors", "/history/resolve/actors", {
      payload: Schema.Struct({
        ids: Schema.Array(Schema.String),
      }),
      success: Schema.Array(ResolvedActor),
      error: HttpApiError.InternalServerError,
    }),
    HttpApiEndpoint.post("resolveUnits", "/history/resolve/units", {
      payload: Schema.Struct({
        ids: Schema.Array(Schema.String),
      }),
      success: Schema.Array(ResolvedUnit),
      error: HttpApiError.InternalServerError,
    }),
  )
  .prefix("/content") {}
