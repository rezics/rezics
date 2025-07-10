import { z } from 'zod/v4';
import { IDSchema, StringSchema, IntSchema, FloatSchema, DateStringSchema } from './base';

// 用户相关
export const UserSchema = z.object({
  id: IDSchema,
  name: StringSchema,
  avatar: StringSchema,
});

export const AuthorSchema = z.object({
  name: StringSchema,
  avatar: StringSchema,
  description: StringSchema,
});

// 书籍相关
export const BookSchema = z.object({
  id: IDSchema,
  title: StringSchema,
  cover: StringSchema,
  author: StringSchema,
  rating: FloatSchema,
  publisher: StringSchema,
  publishDate: StringSchema,
  isbn: StringSchema,
  tags: z.array(StringSchema),
  description: StringSchema,
});

export const BookInfoSchema = z.object({
  book: BookSchema,
  author: AuthorSchema,
  loading: z.boolean(),
  error: StringSchema.nullable(),
});

// 章节相关
export const ChapterSchema = z.object({
  id: IDSchema,
  parentId: IDSchema.optional(),
  chapterName: StringSchema,
  noContent: z.boolean(),
});

export const ChapterOrderSchema = z.object({
  parentId: IDSchema,
  childIds: z.array(IDSchema),
});

export const ChapterContentSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: DateStringSchema,
  chapterName: StringSchema,
  author: UserSchema,
});

// 书单相关
export const BookListSchema = z.object({
  id: IDSchema,
  title: StringSchema,
  description: StringSchema,
  books: z.array(StringSchema),
  creator: UserSchema,
  likes: IntSchema,
  commentsNumber: IntSchema,
});

// 评论相关
export const CommentSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: DateStringSchema,
  likes: IntSchema,
  user: UserSchema,
  replies: z.array(z.lazy(() => CommentSchema)).optional(),
});

// 书评相关
export const ReviewSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  rating: FloatSchema,
  createdAt: DateStringSchema,
  user: UserSchema,
});

// 引用摘录相关
export const QuoteExcerptSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: DateStringSchema,
  author: UserSchema,
});

// 标签相关
export const TagGroupObjectSchema = z.object({
  key: StringSchema,
  name: StringSchema,
  tags: z.array(StringSchema),
});

// 认证相关
export const AuthPayloadSchema = z.object({
  token: StringSchema,
  user: UserSchema,
});

export const ValidationErrorSchema = z.object({
  field: StringSchema,
  message: StringSchema,
});

// 搜索相关
export const SearchBookSchema = z.object({
  id: IDSchema,
  title: StringSchema,
  author: StringSchema,
  description: StringSchema,
  cover: StringSchema,
});

// 导出类型
export type User = z.infer<typeof UserSchema>;
export type Author = z.infer<typeof AuthorSchema>;
export type Book = z.infer<typeof BookSchema>;
export type BookInfo = z.infer<typeof BookInfoSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterOrder = z.infer<typeof ChapterOrderSchema>;
export type ChapterContent = z.infer<typeof ChapterContentSchema>;
export type BookList = z.infer<typeof BookListSchema>;
export type Comment = z.infer<typeof CommentSchema>;
export type Review = z.infer<typeof ReviewSchema>;
export type QuoteExcerpt = z.infer<typeof QuoteExcerptSchema>;
export type TagGroupObject = z.infer<typeof TagGroupObjectSchema>;
export type AuthPayload = z.infer<typeof AuthPayloadSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;
export type SearchBook = z.infer<typeof SearchBookSchema>;