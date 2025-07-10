import { z } from 'zod/v4';
import { SuccessResponseSchema } from '../../base';
import { 
  BookInfoSchema, 
  ChapterSchema, 
  ChapterOrderSchema, 
  ChapterContentSchema, 
  QuoteExcerptSchema, 
  SearchBookSchema 
} from './types';

// 书籍相关响应
export const BookInfoResponseSchema = SuccessResponseSchema(BookInfoSchema);

export const ChapterListResponseSchema = SuccessResponseSchema(z.object({
  chapters: z.array(ChapterSchema),
  chapterOrders: z.array(ChapterOrderSchema),
}));

export const ChapterContentResponseSchema = SuccessResponseSchema(ChapterContentSchema);

export const QuoteExcerptResponseSchema = SuccessResponseSchema(z.array(QuoteExcerptSchema));

// 搜索相关响应
export const SearchBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));
export const TopBooksResponseSchema = SuccessResponseSchema(z.array(SearchBookSchema));

// 导出类型
export type BookInfoResponse = z.infer<typeof BookInfoResponseSchema>;
export type ChapterListResponse = z.infer<typeof ChapterListResponseSchema>;
export type ChapterContentResponse = z.infer<typeof ChapterContentResponseSchema>;
export type QuoteExcerptResponse = z.infer<typeof QuoteExcerptResponseSchema>;
export type SearchBooksResponse = z.infer<typeof SearchBooksResponseSchema>;
export type TopBooksResponse = z.infer<typeof TopBooksResponseSchema>;