import { z } from 'zod/v4';
import { IDSchema, StringSchema, FloatSchema, DateStringSchema } from '../../base';
import { UserSchema, AuthorSchema } from '../user';

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

// 引用摘录相关
export const QuoteExcerptSchema = z.object({
  id: IDSchema,
  content: StringSchema,
  createdAt: DateStringSchema,
  author: UserSchema,
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
export type Book = z.infer<typeof BookSchema>;
export type BookInfo = z.infer<typeof BookInfoSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type ChapterOrder = z.infer<typeof ChapterOrderSchema>;
export type ChapterContent = z.infer<typeof ChapterContentSchema>;
export type QuoteExcerpt = z.infer<typeof QuoteExcerptSchema>;
export type SearchBook = z.infer<typeof SearchBookSchema>;