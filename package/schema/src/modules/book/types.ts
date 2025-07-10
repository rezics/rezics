import { z } from 'zod/v4';
import { ID, String, Float, DateString } from '../../base';
import { User, Author } from '../user';

export const Book = z.object({
  id: ID,
  title: String,
  cover: String,
  author: String,
  rating: Float,
  publisher: String,
  publishDate: String,
  isbn: String,
  tags: z.array(String),
  description: String,
});

export const BookInfo = z.object({
  book: Book,
  author: Author,
  loading: z.boolean(),
  error: String.nullable(),
});

export const Chapter = z.object({
  id: ID,
  parentId: ID.optional(),
  chapterName: String,
  noContent: z.boolean(),
});

export const ChapterOrder = z.object({
  parentId: ID,
  childIds: z.array(ID),
});

export const ChapterContent = z.object({
  id: ID,
  content: String,
  createdAt: DateString,
  chapterName: String,
  author: User,
});

export const QuoteExcerpt = z.object({
  id: ID,
  content: String,
  createdAt: DateString,
  author: User,
});

export const SearchBook = z.object({
  id: ID,
  title: String,
  author: String,
  description: String,
  cover: String,
});

export type Book = z.infer<typeof Book>;
export type BookInfo = z.infer<typeof BookInfo>;
export type Chapter = z.infer<typeof Chapter>;
export type ChapterOrder = z.infer<typeof ChapterOrder>;
export type ChapterContent = z.infer<typeof ChapterContent>;
export type QuoteExcerpt = z.infer<typeof QuoteExcerpt>;
export type SearchBook = z.infer<typeof SearchBook>;