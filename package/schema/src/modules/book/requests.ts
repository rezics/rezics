import { z } from 'zod/v4';

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

export const SearchBooksRequestSchema = z.object({
  query: z.string().min(1),
});

export const GetTopBooksRequestSchema = z.object({});

export type GetBookInfoRequest = z.infer<typeof GetBookInfoRequestSchema>;
export type GetChapterListRequest = z.infer<typeof GetChapterListRequestSchema>;
export type GetChapterContentRequest = z.infer<typeof GetChapterContentRequestSchema>;
export type GetQuoteExcerptRequest = z.infer<typeof GetQuoteExcerptRequestSchema>;
export type SearchBooksRequest = z.infer<typeof SearchBooksRequestSchema>;
export type GetTopBooksRequest = z.infer<typeof GetTopBooksRequestSchema>;