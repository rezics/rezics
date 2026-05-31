/**
 * Book API client functions
 * Direct API communication layer
 */

import type {
  BookContentStructureItem,
  BookContentStructureResponse,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  CreationMode,
  EditorialPatchSubmission,
  ScoreAggregateDTO,
} from "@rezics/contract";
import { CreationMode as CreationModeValue } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import { contentStructureApi } from "../content-structure/content-structure.api";
import type { BookFilters } from "./book.types";

/**
 * Book API methods
 */
export const bookApi = {
  /**
   * List books with optional filters
   * Supports: q, rating, language, tagUnitIds, personId, organizationId,
   * userId, isbn13, visibility, status, sort, start, cursor, limit
   */
  list: async (filters?: BookFilters): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(`/book/list${buildQueryString(filters)}`);
  },

  /**
   * Get single book by unitId
   */
  get: async (unitId: string): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/book/${unitId}`);
  },

  /**
   * Get rating by book unitId
   */
  getRating: async (bookUnitId: string): Promise<ScoreAggregateDTO[]> => {
    return apiFetch<ScoreAggregateDTO[]>(`/book/${bookUnitId}/rating`);
  },

  /**
   * Get content structure by bookUnitId
   */
  getContentStructure: async (
    bookUnitId: string,
  ): Promise<BookContentStructureResponse> => {
    const structure = await contentStructureApi.get(bookUnitId);
    return {
      ...structure,
      bookUnitId: structure.ownerUnitId,
      ownerUnitId: structure.ownerUnitId,
    };
  },

  /**
   * Update content structure by bookUnitId
   */
  updateContentStructure: async (
    bookUnitId: string,
    nodes: BookContentStructureItem[],
  ): Promise<BookContentStructureResponse> => {
    const structure = await contentStructureApi.update(bookUnitId, nodes);
    return {
      ...structure,
      bookUnitId: structure.ownerUnitId,
      ownerUnitId: structure.ownerUnitId,
    };
  },

  /**
   * Search books by query and filters
   */
  search: async (
    query: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Get books by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ userId, ...filters })}`,
    );
  },

  /**
   * Get books by entity ID (attribution credit)
   */
  getByEntityId: async (
    entityId: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ entityId, ...filters })}`,
    );
  },

  /**
   * Get book by ISBN-13
   */
  getByIsbn: async (isbn13: string): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ isbn13 })}`,
    );
  },

  /**
   * Get books by tag unit IDs (comma-separated)
   */
  getByTagUnitIds: async (
    tagUnitIds: string,
    filters?: BookFilters,
  ): Promise<BookListResponse> => {
    return apiFetch<BookListResponse>(
      `/book/list${buildQueryString({ tagUnitIds, ...filters })}`,
    );
  },

  /**
   * Create new book
   */
  create: async (input: CreateBookInput): Promise<BookResponse> => {
    return apiFetch<BookResponse>("/book", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createWithMode: async (
    input: Omit<CreateBookInput, "creationMode">,
    creationMode: CreationMode,
  ): Promise<BookResponse> => {
    return bookApi.create({ ...input, creationMode });
  },

  createWiki: async (
    input: Omit<CreateBookInput, "creationMode">,
  ): Promise<BookResponse> => {
    return bookApi.createWithMode(input, CreationModeValue.WIKI);
  },

  createPersonal: async (
    input: Omit<CreateBookInput, "creationMode">,
  ): Promise<BookResponse> => {
    return bookApi.createWithMode(input, CreationModeValue.PERSONAL);
  },

  /**
   * Update existing book
   */
  update: async (
    unitId: string,
    input: EditorialPatchSubmission,
  ): Promise<BookResponse> => {
    return apiFetch<BookResponse>(`/book/${unitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete book
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/book/${unitId}`, {
      method: "DELETE",
    });
  },
};
