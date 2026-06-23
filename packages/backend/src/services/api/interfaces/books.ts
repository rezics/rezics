import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class BookDTO extends Schema.Class<BookDTO>("BookDTO")({
  unitId: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  status: Schema.String,
  visibility: Schema.String,
  isbn13: Schema.NullOr(Schema.String),
  pageCount: Schema.NullOr(Schema.Number),
  textLength: Schema.Number,
  chapterCount: Schema.Number,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class BookListResult extends Schema.Class<BookListResult>("BookListResult")({
  books: Schema.Array(BookDTO),
  total: Schema.Number,
}) {}

export class ScoreAggregateDTO extends Schema.Class<ScoreAggregateDTO>("ScoreAggregateDTO")({
  realmUnitId: Schema.String,
  average: Schema.Number,
  count: Schema.Number,
}) {}

export class ContentStructureNodeDTO extends Schema.Class<ContentStructureNodeDTO>(
  "ContentStructureNodeDTO",
)({
  id: Schema.String,
  parentId: Schema.NullOr(Schema.String),
  position: Schema.String,
  contentUnitId: Schema.NullOr(Schema.String),
  title: Schema.String,
  noContent: Schema.Boolean,
}) {}

export class ContentStructureDTO extends Schema.Class<ContentStructureDTO>(
  "ContentStructureDTO",
)({
  ownerUnitId: Schema.String,
  nodes: Schema.Array(ContentStructureNodeDTO),
}) {}

export class ChapterDTO extends Schema.Class<ChapterDTO>("ChapterDTO")({
  unitId: Schema.String,
  title: Schema.String,
  content: Schema.NullOr(Schema.String),
  status: Schema.String,
  targetUnitId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class ChapterListResult extends Schema.Class<ChapterListResult>("ChapterListResult")({
  items: Schema.Array(ChapterDTO),
  total: Schema.Number,
}) {}

export class ChapterMaterializationResult extends Schema.Class<ChapterMaterializationResult>(
  "ChapterMaterializationResult",
)({
  unitId: Schema.String,
  nodeId: Schema.String,
  created: Schema.Boolean,
}) {}

export class SeriesDTO extends Schema.Class<SeriesDTO>("SeriesDTO")({
  unitId: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  status: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class SeriesDetailDTO extends Schema.Class<SeriesDetailDTO>("SeriesDetailDTO")({
  unitId: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  status: Schema.String,
  contentStructure: Schema.NullOr(ContentStructureDTO),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class SeriesContentIndexRow extends Schema.Class<SeriesContentIndexRow>(
  "SeriesContentIndexRow",
)({
  nodeId: Schema.String,
  contentUnitId: Schema.NullOr(Schema.String),
  position: Schema.String,
  title: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class BookNotFound extends Schema.TaggedErrorClass<BookNotFound>()(
  "BookNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class BookForbidden extends Schema.TaggedErrorClass<BookForbidden>()(
  "BookForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class ChapterNotFound extends Schema.TaggedErrorClass<ChapterNotFound>()(
  "ChapterNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class ChapterForbidden extends Schema.TaggedErrorClass<ChapterForbidden>()(
  "ChapterForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class SeriesNotFound extends Schema.TaggedErrorClass<SeriesNotFound>()(
  "SeriesNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class SeriesForbidden extends Schema.TaggedErrorClass<SeriesForbidden>()(
  "SeriesForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /book — Book CRUD + rating + content structure
// /chapter — Chapter CRUD + materialization
// /series-unit — Series CRUD + content structure + content index
// ---------------------------------------------------------------------------

export class BooksGroup extends HttpApiGroup.make("books")
  .add(
    // ── Book CRUD ─────────────────────────────────────────────
    // ── Book 增删改查 ─────────────────────────────────────────

    // GET /book/:unitId — get book by unit ID
    // 根据 unit ID 获取书籍
    HttpApiEndpoint.get("getBook", "/book/:unitId", {
      params: { unitId: Schema.String },
      query: {
        explicitLanguage: Schema.optional(Schema.String),
        languages: Schema.optional(Schema.String),
        appLocale: Schema.optional(Schema.String),
      },
      success: BookDTO,
      error: [BookNotFound, HttpApiError.InternalServerError],
    }),

    // POST /book — create book
    // 创建书籍
    HttpApiEndpoint.post("createBook", "/book", {
      payload: Schema.Struct({
        title: Schema.String,
        defaultLanguage: Schema.optional(Schema.String),
        isbn13: Schema.optional(Schema.String),
        pageCount: Schema.optional(Schema.Number),
        coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
        status: Schema.optional(Schema.String),
      }),
      success: BookDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // PATCH /book/:unitId — update book via editorial patch
    // 通过编辑补丁更新书籍
    HttpApiEndpoint.patch("updateBook", "/book/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        patch: Schema.Record(Schema.String, Schema.Unknown),
      }),
      success: BookDTO,
      error: [BookNotFound, BookForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /book/:unitId — delete book
    // 删除书籍
    HttpApiEndpoint.delete("deleteBook", "/book/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [BookNotFound, BookForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Book rating ───────────────────────────────────────────

    // GET /book/:unitId/rating — get score aggregates
    // 获取评分汇总
    HttpApiEndpoint.get("getBookRating", "/book/:unitId/rating", {
      params: { unitId: Schema.String },
      success: Schema.Array(ScoreAggregateDTO),
      error: [BookNotFound, HttpApiError.InternalServerError],
    }),

    // ── Book content structure ────────────────────────────────

    // GET /book/:unitId/content-structure — get content structure
    // 获取内容结构
    HttpApiEndpoint.get("getBookContentStructure", "/book/:unitId/content-structure", {
      params: { unitId: Schema.String },
      success: ContentStructureDTO,
      error: [BookNotFound, HttpApiError.InternalServerError],
    }),

    // PUT /book/:unitId/content-structure — update content structure
    // 更新内容结构
    HttpApiEndpoint.put("updateBookContentStructure", "/book/:unitId/content-structure", {
      params: { unitId: Schema.String },
      payload: Schema.Unknown,
      success: ContentStructureDTO,
      error: [BookNotFound, BookForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Book list ─────────────────────────────────────────────

    // GET /book/list — list books (query-string filters)
    // 列出书籍（查询字符串过滤）
    HttpApiEndpoint.get("listBooks", "/book/list", {
      query: {
        userId: Schema.optional(Schema.String),
        status: Schema.optional(Schema.String),
        search: Schema.optional(Schema.String),
        languages: Schema.optional(Schema.String),
        appLocale: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: BookListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // POST /book/list — list books (body filters)
    // 列出书籍（body 过滤）
    HttpApiEndpoint.post("listBooksByBody", "/book/list", {
      payload: Schema.Struct({
        userId: Schema.optional(Schema.String),
        status: Schema.optional(Schema.String),
        search: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.Array(Schema.String)),
        languages: Schema.optional(Schema.String),
        appLocale: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: BookListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // ── Chapters ──────────────────────────────────────────────
    // ── 章节 ──────────────────────────────────────────────────

    // GET /chapter/:unitId — get chapter
    // 获取章节
    HttpApiEndpoint.get("getChapter", "/chapter/:unitId", {
      params: { unitId: Schema.String },
      success: ChapterDTO,
      error: [ChapterNotFound, HttpApiError.InternalServerError],
    }),

    // POST /chapter — create chapter
    // 创建章节
    HttpApiEndpoint.post("createChapter", "/chapter", {
      payload: Schema.Struct({
        title: Schema.String,
        content: Schema.optional(Schema.NullOr(Schema.String)),
        targetUnitId: Schema.optional(Schema.String),
        coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
        status: Schema.optional(Schema.String),
      }),
      success: ChapterDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // PUT /chapter/:unitId — update chapter
    // 更新章节
    HttpApiEndpoint.put("updateChapter", "/chapter/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        title: Schema.optional(Schema.String),
        content: Schema.optional(Schema.NullOr(Schema.String)),
        coverUrl: Schema.optional(Schema.NullOr(Schema.String)),
        status: Schema.optional(Schema.String),
      }),
      success: ChapterDTO,
      error: [ChapterNotFound, ChapterForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /chapter/:unitId — delete chapter
    // 删除章节
    HttpApiEndpoint.delete("deleteChapter", "/chapter/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [ChapterNotFound, ChapterForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /chapter/materialize/book/:bookUnitId — materialize chapter from content node
    // 从内容节点物化章节
    HttpApiEndpoint.post("materializeChapter", "/chapter/materialize/book/:bookUnitId", {
      params: { bookUnitId: Schema.String },
      payload: Schema.Struct({
        nodeId: Schema.String,
      }),
      success: ChapterMaterializationResult,
      error: [BookNotFound, ChapterNotFound, BookForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Series ────────────────────────────────────────────────
    // ── 系列 ──────────────────────────────────────────────────

    // GET /series-unit/:unitId — get series detail
    // 获取系列详情
    HttpApiEndpoint.get("getSeries", "/series-unit/:unitId", {
      params: { unitId: Schema.String },
      success: SeriesDetailDTO,
      error: [SeriesNotFound, HttpApiError.InternalServerError],
    }),

    // POST /series-unit — create series
    // 创建系列
    HttpApiEndpoint.post("createSeries", "/series-unit", {
      payload: Schema.Struct({
        title: Schema.String,
        defaultLanguage: Schema.optional(Schema.String),
      }),
      success: SeriesDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // PATCH /series-unit/:unitId — update series
    // 更新系列
    HttpApiEndpoint.patch("updateSeries", "/series-unit/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        title: Schema.optional(Schema.String),
        status: Schema.optional(Schema.String),
      }),
      success: SeriesDTO,
      error: [SeriesNotFound, SeriesForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /series-unit/:unitId/content-structure — update series content structure
    // 更新系列内容结构
    HttpApiEndpoint.put("updateSeriesContentStructure", "/series-unit/:unitId/content-structure", {
      params: { unitId: Schema.String },
      payload: Schema.Array(Schema.Unknown),
      success: ContentStructureDTO,
      error: [SeriesNotFound, SeriesForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /series-unit/:unitId/content-index — list content index rows
    // 列出内容索引行
    HttpApiEndpoint.get("getSeriesContentIndex", "/series-unit/:unitId/content-index", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ rows: Schema.Array(SeriesContentIndexRow) }),
      error: [SeriesNotFound, HttpApiError.InternalServerError],
    }),
  ) {}
