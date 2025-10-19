import {t} from 'elysia';

// =================================================================
// 1. Core Data Transfer Objects (DTOs)
// =================================================================

const User = t.Object({
  id: t.String(),
  name: t.String(),
});

type User = (typeof User)['static'];

/**
 * 用户的公开信息 Schema
 * (原 PublicUser type)
 */
export const publicUserSchema = t.Object({
  id: t.String(),
  slug: t.Optional(t.String()),
  name: t.String(),
  avatar: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.String()),
});

export type PublicUser = (typeof publicUserSchema)['static'];

/**
 * API 返回的 Book DTO Schema
 * (原 BookDTO type)
 */
export const bookDTOSchema = t.Object({
  unitId: t.String(),
  title: t.String(),
  authors: t.Optional(t.Array(publicUserSchema)),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  // 保持与 Input 一致，允许 null
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  // 保持与 Input 一致
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  userId: t.Optional(t.String()),
  user: t.Optional(publicUserSchema),
  description: t.Optional(t.String()),
  // t.Union 用于匹配 'string | Date'
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type BookDTO = (typeof bookDTOSchema)['static'];

// =================================================================
// 2. API Endpoint Schemas & Types
// =================================================================

// --- Book List (GET /books) ---

/**
 * [Query] /books 的查询参数 Schema
 */
export const bookListQuerySchema = t.Object({
  q: t.Optional(t.String()), // search in title/isbn
  tag: t.Optional(t.String()), // single tag
  tags: t.Optional(t.String()), // comma-separated list
  authorId: t.Optional(t.String()),
  authorIds: t.Optional(t.String()), // comma-separated list
  userId: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  page: t.Optional(t.Numeric()), // 1-based
  limit: t.Optional(t.Numeric()), // default 20
});

export type BookListQuery = (typeof bookListQuerySchema)['static'];

/**
 * [Response] /books 的响应体 Schema
 * (原 BookListResponse type)
 */
export const bookListResponseSchema = t.Object({
  books: t.Array(bookDTOSchema), // 重用 book DTO
  total: t.Optional(t.Number()), // 响应体中使用 t.Number()
});

export type BookListResponse = (typeof bookListResponseSchema)['static'];

// --- Book Detail (GET /books/:unitId) ---

/**
 * [Params] /books/:postId 的路径参数 Schema
 */
export const bookParamsSchema = t.Object({
  unitId: t.String(),
});

export type BookParams = (typeof bookParamsSchema)['static'];

/**
 * [Response] /books/:postId 的响应体 Schema
 * (原 BookResponse type)
 */
export const bookResponseSchema = bookDTOSchema; // 直接复用 DTO

export type BookResponse = (typeof bookResponseSchema)['static']; // 等同于 BookDTO

// --- Create Book (POST /books) ---

/**
 * [Body] POST /books 的请求体 Schema
 * (原 createBookSchema)
 */
export const createBookSchema = t.Object({
  userId: t.String(),
  title: t.String(),
  authorIds: t.Optional(t.Array(t.String())),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  description: t.Optional(t.String()),
});

// 从 Schema 派生类型，替换原有的 CreateBookInput
export type CreateBookInput = (typeof createBookSchema)['static'];

// --- Update Book (PUT /books/:postId) ---

/**
 * [Body] PUT /books/:postId 的请求体 Schema
 * (原 updateBookSchema)
 */
export const updateBookSchema = t.Object({
  title: t.Optional(t.String()),
  authorIds: t.Optional(t.Array(t.String())),
  coverUrl: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  chaptersIndex: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  description: t.Optional(t.String()),
});

// 从 Schema 派生类型，替换原有的 UpdateBookInput
export type UpdateBookInput = (typeof updateBookSchema)['static'];

// =================================================================
// 3. Internal Service/Repository Types
// =================================================================

/**
 * 内部服务层使用的搜索参数 Schema
 * (原 BookSearchParams type)
 * 注意：page 转换为了 start，t.Numeric 转换为了 t.Number
 */
export const bookSearchParamsSchema = t.Object({
  q: t.Optional(t.String()),
  tag: t.Optional(t.String()),
  tags: t.Optional(t.String()),
  authorId: t.Optional(t.String()),
  authorIds: t.Optional(t.String()),
  userId: t.Optional(t.String()),
  isbn: t.Optional(t.String()),
  start: t.Optional(t.Number()), // (page - 1) * limit
  limit: t.Optional(t.Number()),
});

export type BookSearchParams = (typeof bookSearchParamsSchema)['static'];
