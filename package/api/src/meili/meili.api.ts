/**
 * Meilisearch API client
 *
 * Frontend wrapper around the backend Meili search endpoints.
 */

import type {
  BookListResponse,
  FeedbackListQuery,
  FeedbackSearchResult,
  ReadlistListQuery,
  ReadlistSearchResult,
  UnitListResponse,
  UserDTO,
  UserListQuery,
} from "@rezics/contract";
import type { BookFilters } from "../book/book.types";
import { apiFetch } from "../react-query/http";
import type { UnitFilters } from "../unit/unit.types";
import { buildQueryString } from "../utils/buildQuery";

export * from "./mapper";

export const meiliBookApi = {
  /**
   * Search books via backend Meilisearch controller.
   *
   * The backend expects a `BookQueryOptions` object encoded in the query string.
   */
  bookSearch: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/meili/books/search`, {
      method: "POST",
      body: JSON.stringify(filters),
    });
  },
};

export const meiliReadlistApi = {
  /**
   * Search readlists via backend Meilisearch controller.
   *
   * The backend expects a `ReadlistListQuery` object encoded in the request body.
   */
  readlistSearch: async (
    filters?: ReadlistListQuery,
  ): Promise<ReadlistSearchResult> => {
    return apiFetch<ReadlistSearchResult>(`/meili/readlists/search`, {
      method: "POST",
      body: JSON.stringify(filters),
    });
  },
};

export const meiliUnitApi = {
  unitSearch: async (filters?: UnitFilters): Promise<UnitListResponse> => {
    return apiFetch<UnitListResponse>(
      `/meili/units/search${buildQueryString(filters)}`,
    );
  },
};

export const meiliFeedbackApi = {
  /**
   * Search feedbacks via backend Meilisearch controller.
   *
   * The backend expects a `FeedbackListQuery` object encoded in the request body.
   */
  feedbackSearch: async (
    filters?: FeedbackListQuery,
  ): Promise<FeedbackSearchResult> => {
    return apiFetch<FeedbackSearchResult>(`/meili/feedbacks/search`, {
      method: "POST",
      body: JSON.stringify(filters),
    });
  },
};

export type UserSearchResponse = {
  users: Omit<UserDTO, "email">[];
  total: number;
};

export const meiliUserApi = {
  /**
   * Search users via backend Meilisearch controller.
   *
   * The backend expects a `UserListQuery` object encoded in the query string.
   */
  userSearch: async (query?: UserListQuery): Promise<UserSearchResponse> => {
    // NOTE:
    // `URLSearchParams({ q: undefined })` serializes to `q=undefined`,
    // which breaks "empty search" behavior on the backend.
    // Use our shared helper to omit undefined/null/'' values.
    return apiFetch<UserSearchResponse>(
      `/meili/users/search${buildQueryString(query as any)}`,
    );
  },
};
