import { z } from 'zod/v4';
import { SuccessResponse } from '../../base';
import { 
  BookInfo, 
  Chapter, 
  ChapterOrder, 
  ChapterContent, 
  QuoteExcerpt, 
  SearchBook 
} from './types';

export const BookInfoResponse = SuccessResponse(BookInfo);

export const ChapterListResponse = SuccessResponse(z.object({
  chapters: z.array(Chapter),
  chapterOrders: z.array(ChapterOrder),
}));

export const ChapterContentResponse = SuccessResponse(ChapterContent);

export const QuoteExcerptResponse = SuccessResponse(z.array(QuoteExcerpt));

export const SearchBooksResponse = SuccessResponse(z.array(SearchBook));
export const TopBooksResponse = SuccessResponse(z.array(SearchBook));

export type BookInfoResponse = z.infer<typeof BookInfoResponse>;
export type ChapterListResponse = z.infer<typeof ChapterListResponse>;
export type ChapterContentResponse = z.infer<typeof ChapterContentResponse>;
export type QuoteExcerptResponse = z.infer<typeof QuoteExcerptResponse>;
export type SearchBooksResponse = z.infer<typeof SearchBooksResponse>;
export type TopBooksResponse = z.infer<typeof TopBooksResponse>;