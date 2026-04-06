import { t } from "elysia";
import { publicUserSchema } from "./unit";

// ANCHOR Core Data Transfer Objects (DTOs)

/**
 * API 返回的 Book DTO Schema
 * (原 BookDTO type)
 */
export const bookDTOSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  author: t.Optional(t.Array(publicUserSchema)),
  press: t.Optional(t.Array(publicUserSchema)),
  producer: t.Optional(t.Array(publicUserSchema)),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  textLength: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  // 保持与 Input 一致，允许 null
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  // 保持与 Input 一致
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  userId: t.Optional(t.String()),
  user: t.Optional(publicUserSchema),
  tags: t.Optional(t.Array(t.String())),
  description: t.Optional(t.String()),
  reactionSummaries: t.Optional(t.Any()),
  // t.Union 用于匹配 'string | Date'
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type BookDTO = (typeof bookDTOSchema)["static"];

// ANCHOR API Endpoint Schemas & Types

// --- Book List (GET /books) ---

/**
 * [Query] /books 的查询参数 Schema
 */
export const bookListQuerySchema = t.Object({
  q: t.Optional(t.String()), // search in title/isbn
  // 是否搜索 NSFW 内容；不传或为 false 时，只返回非 NSFW 内容
  nsfw: t.Optional(t.Boolean()),
  tag: t.Optional(t.String()), // single tag
  tags: t.Optional(t.String()), // comma-separated list
  authorId: t.Optional(t.String()),
  authorIds: t.Optional(t.String()), // comma-separated list
  pressId: t.Optional(t.String()),
  pressIds: t.Optional(t.String()),
  producerId: t.Optional(t.String()),
  producerIds: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(t.String()), // sort by createdAt or updatedAt
      order: t.Optional(t.String()), // asc or desc
    }),
  ),
  start: t.Optional(t.Number()), // (page - 1) * limit
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()), // default 20
});

export type BookListQuery = (typeof bookListQuerySchema)["static"];

/**
 * [Response] /books 的响应体 Schema
 * (原 BookListResponse type)
 */
export const bookListResponseSchema = t.Object({
  books: t.Array(bookDTOSchema), // 重用 book DTO
  total: t.Optional(t.Number()), // 响应体中使用 t.Number()
});

export type BookListResponse = (typeof bookListResponseSchema)["static"];

// --- Book Detail (GET /books/:unitId) ---

/**
 * [Params] /books/:postId 的路径参数 Schema
 */
export const bookParamsSchema = t.Object({
  unitId: t.String(),
});

export type BookParams = (typeof bookParamsSchema)["static"];

/**
 * [Response] /books/:postId 的响应体 Schema
 * (原 BookResponse type)
 */
export const bookResponseSchema = bookDTOSchema; // 直接复用 DTO

export type BookResponse = (typeof bookResponseSchema)["static"]; // 等同于 BookDTO

// --- Create Book (POST /books) ---

/**
 * [Body] POST /books 的请求体 Schema
 * (原 createBookSchema)
 */
export const createBookSchema = t.Object({
  userId: t.Optional(t.String()),
  title: t.String(),
  authorIds: t.Optional(t.Array(t.String())),
  pressIds: t.Optional(t.Array(t.String())),
  producerIds: t.Optional(t.Array(t.String())),
  nsfw: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  textLength: t.Optional(t.String()),
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  description: t.Optional(t.String()),
});

// 从 Schema 派生类型，替换原有的 CreateBookInput
export type CreateBookInput = (typeof createBookSchema)["static"];

// --- Update Book (PUT /books/:postId) ---

/**
 * [Body] PUT /books/:postId 的请求体 Schema
 * (原 updateBookSchema)
 */
export const updateBookSchema = t.Object({
  title: t.Optional(t.String()),
  authorIds: t.Optional(t.Array(t.String())),
  pressIds: t.Optional(t.Array(t.String())),
  producerIds: t.Optional(t.Array(t.String())),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  textLength: t.Optional(t.String()),
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  description: t.Optional(t.String()),
});

// 从 Schema 派生类型，替换原有的 UpdateBookInput
export type UpdateBookInput = (typeof updateBookSchema)["static"];

export interface ChapterTreeItem {
  id: string;
  title: string;
  noContent: boolean;
  children?: ChapterTreeItem[];
}

export interface ChapterIndexResponse {
  bookUnitId: string;
  index: ChapterTreeItem[];
  createdAt: Date;
  updatedAt: Date;
}

// ANCHOR Extra Types

export type Publisher = {};
