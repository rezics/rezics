import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware } from "./middlewares/auth.ts";

// -- Response schemas / 响应 schema --

export class ScoreEntryResult extends Schema.Class<ScoreEntryResult>("ScoreEntryResult")({
  id: Schema.String,
  userId: Schema.String,
  unitId: Schema.String,
  realm: Schema.String,
  value: Schema.Number,
  fields: Schema.NullOr(Schema.Unknown),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class ScoreAggregateResult extends Schema.Class<ScoreAggregateResult>("ScoreAggregateResult")({
  unitId: Schema.String,
  realm: Schema.String,
  totalScore: Schema.Number,
  totalCount: Schema.Number,
  distribution: Schema.Unknown,
  fields: Schema.NullOr(Schema.Unknown),
  updatedAt: Schema.DateFromString,
}) {}

export class ScoreRealmFieldResult extends Schema.Class<ScoreRealmFieldResult>("ScoreRealmFieldResult")({
  realm: Schema.String,
  key: Schema.String,
  label: Schema.NullOr(Schema.String),
  position: Schema.String,
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

// -- Error schemas / 错误 schema --

export class ScoreNotFound extends Schema.TaggedErrorClass<ScoreNotFound>()(
  "ScoreNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class ScoreForbidden extends Schema.TaggedErrorClass<ScoreForbidden>()(
  "ScoreForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class ScoreConflict extends Schema.TaggedErrorClass<ScoreConflict>()(
  "ScoreConflict",
  {},
  { httpApiStatus: 409 },
) {}

// -- Group / 分组 --

export class ScoresGroup extends HttpApiGroup.make("scores")
  .add(
    // POST /score/ — upsert score (requires login)
    // POST /score/ — 写入或更新评分（需要登录）
    HttpApiEndpoint.post("upsert", "/", {
      payload: Schema.Struct({
        unitId: Schema.String,
        realm: Schema.String,
        value: Schema.Number,
        fields: Schema.optional(Schema.Record(Schema.String, Schema.Number)),
      }),
      success: ScoreEntryResult,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),
    // DELETE /score/:id — delete score (requires login)
    // DELETE /score/:id — 删除评分（需要登录）
    HttpApiEndpoint.delete("delete", "/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [ScoreNotFound, ScoreConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // GET /score/unit/:unitId — all realm aggregates for a unit
    // GET /score/unit/:unitId — 某个 unit 的所有 realm 聚合数据
    HttpApiEndpoint.get("aggregatesByUnit", "/unit/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Array(ScoreAggregateResult),
      error: HttpApiError.InternalServerError,
    }),
    // GET /score/user/:userId/:unitId — user's score entries for a unit
    // GET /score/user/:userId/:unitId — 用户对某个 unit 的评分条目
    HttpApiEndpoint.get("userScores", "/user/:userId/:unitId", {
      params: { userId: Schema.String, unitId: Schema.String },
      success: Schema.Array(ScoreEntryResult),
      error: HttpApiError.InternalServerError,
    }),
    // POST /score/recalculate — admin recalculation
    // POST /score/recalculate — 管理员触发重算
    HttpApiEndpoint.post("recalculate", "/recalculate", {
      payload: Schema.Struct({
        unitId: Schema.String,
        realm: Schema.String,
      }),
      success: Schema.NullOr(ScoreAggregateResult),
      error: [ScoreForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // GET /score/realm/:realmId — list realm score fields
    // GET /score/realm/:realmId — 列出 realm 的评分字段
    HttpApiEndpoint.get("listRealmFields", "/realm/:realmId", {
      params: { realmId: Schema.String },
      success: Schema.Array(ScoreRealmFieldResult),
      error: HttpApiError.InternalServerError,
    }),
    // POST /score/realm/:realmId — add realm field (admin)
    // POST /score/realm/:realmId — 新增 realm 字段（管理员）
    HttpApiEndpoint.post("addRealmField", "/realm/:realmId", {
      params: { realmId: Schema.String },
      payload: Schema.Struct({
        key: Schema.String,
        label: Schema.optional(Schema.String),
        position: Schema.optional(Schema.String),
      }),
      success: ScoreRealmFieldResult,
      error: [ScoreForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // DELETE /score/realm/:realmId/:key — remove realm field (admin)
    // DELETE /score/realm/:realmId/:key — 移除 realm 字段（管理员）
    HttpApiEndpoint.delete("removeRealmField", "/realm/:realmId/:key", {
      params: { realmId: Schema.String, key: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [ScoreNotFound, ScoreForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/score") {}
