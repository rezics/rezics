/**
 * React Query configurations for Book queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { bookApi } from "./book.api";
import { bookKeys } from "./book.keys";
import type { BookFilters } from "./book.types";

/**
 * Query options for listing books
 */
export const bookListQuery = (filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.list(filters),
    queryFn: () => bookApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single book
 */
export const bookDetailQuery = (postId: string) =>
  queryOptions({
    queryKey: bookKeys.detail(postId),
    queryFn: () => bookApi.get(postId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for searching books
 */
export const bookSearchQuery = (query: string, filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.search(query, filters),
    queryFn: () => bookApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Query options for getting books by user
 */
export const booksByUserQuery = (userId: string, filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.byUser(userId),
    queryFn: () => bookApi.getByUserId(userId, filters),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting books by author
 */
export const booksByAuthorQuery = (authorId: string, filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.byAuthor(authorId),
    queryFn: () => bookApi.getByAuthorId(authorId, filters),
    enabled: !!authorId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting book by ISBN
 */
export const bookByIsbnQuery = (isbn: string) =>
  queryOptions({
    queryKey: bookKeys.byIsbn(isbn),
    queryFn: () => bookApi.getByIsbn(isbn),
    enabled: !!isbn,
    staleTime: 1000 * 60 * 30, // 30 minutes - ISBN lookups are stable
  });

/**
 * Infinite query options for paginated book list
 * @todo Migrating from page to offset
 */
export const bookInfiniteListQuery = (filters?: Omit<BookFilters, "page">) =>
  infiniteQueryOptions({
    queryKey: bookKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      bookApi.list({ ...filters, start: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const { books, total } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        books.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting chapterIndex by bookUnitId
 */
export const bookChapterIndexQuery = (bookUnitId: string) =>
  queryOptions({
    queryKey: bookKeys.chapterIndex(bookUnitId),
    queryFn: () => bookApi.getChapterIndex(bookUnitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting rating by book unitId
 */
export const bookRatingQuery = (bookUnitId: string) =>
  queryOptions({
    queryKey: bookKeys.rating(bookUnitId),
    queryFn: () => bookApi.getRating(bookUnitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Combined query options export
 */
export const bookQueries = {
  list: bookListQuery,
  detail: bookDetailQuery,
  search: bookSearchQuery,
  rating: bookRatingQuery,
  byUser: booksByUserQuery,
  byAuthor: booksByAuthorQuery,
  byIsbn: bookByIsbnQuery,
  infiniteList: bookInfiniteListQuery,
  chapterIndex: bookChapterIndexQuery,
};
