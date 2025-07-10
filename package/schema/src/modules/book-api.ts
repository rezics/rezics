import { z } from 'zod/v4';
import { 
  BookInfoSchema, 
  ChapterSchema, 
  ChapterOrderSchema, 
  ChapterContentSchema, 
  QuoteExcerptSchema 
} from './book';
import { SuccessResponseSchema } from '../base';

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

// 导出类型
export type GetBookInfoRequest = z.infer<typeof GetBookInfoRequestSchema>;
export type GetChapterListRequest = z.infer<typeof GetChapterListRequestSchema>;
export type GetChapterContentRequest = z.infer<typeof GetChapterContentRequestSchema>;
export type GetQuoteExcerptRequest = z.infer<typeof GetQuoteExcerptRequestSchema>;
export type BookInfoResponse = z.infer<typeof BookInfoResponseSchema>;
export type ChapterListResponse = z.infer<typeof ChapterListResponseSchema>;
export type ChapterContentResponse = z.infer<typeof ChapterContentResponseSchema>;
export type QuoteExcerptResponse = z.infer<typeof QuoteExcerptResponseSchema>;