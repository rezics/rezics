import { z } from 'zod/v4';

export const GetBookInfoRequest = z.object({
  id: z.string().min(1),
});

export const GetChapterListRequest = z.object({
  id: z.string().min(1),
});

export const GetChapterContentRequest = z.object({
  chapterId: z.string().min(1),
});

export const GetQuoteExcerptRequest = z.object({
  bookId: z.string().min(1),
});

export const SearchBooksRequest = z.object({
  query: z.string().min(1),
});

export const GetTopBooksRequest = z.object({});

export type GetBookInfoRequest = z.infer<typeof GetBookInfoRequest>;
export type GetChapterListRequest = z.infer<typeof GetChapterListRequest>;
export type GetChapterContentRequest = z.infer<typeof GetChapterContentRequest>;
export type GetQuoteExcerptRequest = z.infer<typeof GetQuoteExcerptRequest>;
export type SearchBooksRequest = z.infer<typeof SearchBooksRequest>;
export type GetTopBooksRequest = z.infer<typeof GetTopBooksRequest>;