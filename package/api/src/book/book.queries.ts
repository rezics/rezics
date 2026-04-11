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
export const bookDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: bookKeys.detail(unitId),
    queryFn: () => bookApi.get(unitId),
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
 * Query options for getting books by person (attribution credit)
 */
export const booksByPersonQuery = (personId: string, filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.byPerson(personId),
    queryFn: () => bookApi.getByPersonId(personId, filters),
    enabled: !!personId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting books by organization (attribution credit)
 */
export const booksByOrganizationQuery = (
  organizationId: string,
  filters?: BookFilters,
) =>
  queryOptions({
    queryKey: bookKeys.byOrganization(organizationId),
    queryFn: () => bookApi.getByOrganizationId(organizationId, filters),
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting book by ISBN-13
 */
export const bookByIsbnQuery = (isbn13: string) =>
  queryOptions({
    queryKey: bookKeys.byIsbn(isbn13),
    queryFn: () => bookApi.getByIsbn(isbn13),
    enabled: !!isbn13,
    staleTime: 1000 * 60 * 30, // 30 minutes - ISBN lookups are stable
  });

/**
 * Query options for getting books by tag unit IDs
 */
export const booksByTagsQuery = (tagUnitIds: string, filters?: BookFilters) =>
  queryOptions({
    queryKey: bookKeys.byTags(tagUnitIds),
    queryFn: () => bookApi.getByTagUnitIds(tagUnitIds, filters),
    enabled: !!tagUnitIds,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Infinite query options for paginated book list
 */
export const bookInfiniteListQuery = (filters?: Omit<BookFilters, "start">) =>
  infiniteQueryOptions({
    queryKey: bookKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      bookApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { books, total } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = books.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
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
  byPerson: booksByPersonQuery,
  byOrganization: booksByOrganizationQuery,
  byIsbn: bookByIsbnQuery,
  byTags: booksByTagsQuery,
  infiniteList: bookInfiniteListQuery,
  chapterIndex: bookChapterIndexQuery,
};
