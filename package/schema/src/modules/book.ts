import { z } from 'zod/v4';
import { IDSchema, StringSchema, FloatSchema, DateStringSchema, SuccessResponseSchema } from '../base';
import { UserSchema, AuthorSchema } from './user';

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

// ==================== API 请求和响应 ====================

// 书籍相关请求
export const GetBookInfoRequestSchema = z.object({
  id: z.string().min(1),
});

export const GetChapterListRequestSchema = z.object({
  id: z.string().min(1),
});

export const GetChapterContentRequestSchema = z.object({
  chapterId: z.string().min(1),
});

export const GetQuoteExcerptRequestSchema = z.object({
  bookId: z.string().min(1),
});

// 书籍相关响应
export const BookInfoResponseSchema = SuccessResponseSchema(BookInfoSchema);

export const ChapterListResponseSchema = SuccessResponseSchema(z.object({
  chapters: z.array(ChapterSchema),
  chapterOrders: z.array(ChapterOrderSchema),
}));

export const ChapterContentResponseSchema = SuccessResponseSchema(ChapterContentSchema);

export const QuoteExcerptResponseSchema = SuccessResponseSchema(z.array(QuoteExcerptSchema));

// API 类型导出
export type GetBookInfoRequest = z.infer<typeof GetBookInfoRequestSchema>;
export type GetChapterListRequest = z.infer<typeof GetChapterListRequestSchema>;
export type GetChapterContentRequest = z.infer<typeof GetChapterContentRequestSchema>;
export type GetQuoteExcerptRequest = z.infer<typeof GetQuoteExcerptRequestSchema>;
export type BookInfoResponse = z.infer<typeof BookInfoResponseSchema>;
export type ChapterListResponse = z.infer<typeof ChapterListResponseSchema>;
export type ChapterContentResponse = z.infer<typeof ChapterContentResponseSchema>;
export type QuoteExcerptResponse = z.infer<typeof QuoteExcerptResponseSchema>;

// 搜索相关请求
export const SearchBooksRequestSchema = z.object({
  query: z.string().min(1),
});

export const GetTopBooksRequestSchema = z.object({});

// 搜索相关响应
export const SearchBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));
export const TopBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));

// 搜索 API 类型导出
export type SearchBooksRequest = z.infer<typeof SearchBooksRequestSchema>;
export type GetTopBooksRequest = z.infer<typeof GetTopBooksRequestSchema>;
export type SearchBooksResponse = z.infer<typeof SearchBooksResponseSchema>;
export type TopBooksResponse = z.infer<typeof TopBooksResponseSchema>;