/**
 * Readlist API client functions
 * Direct API communication layer
 */

import type {
  CreateReadlistInput,
  UpdateReadlistInput,
  ReadlistListResponse,
  ReadlistResponse,
} from '@rezics/contract';
import type {ReadlistFilters} from './readlist.types';
import {buildQueryString} from '../utils/buildQuery';

import {apiFetch} from '../react-query/http';

/**
 * Readlist API methods
 */
export const readlistApi = {
  /**
   * List readlists with optional filters
   */
  list: async (filters?: ReadlistFilters): Promise<ReadlistListResponse> => {
    return apiFetch<ReadlistListResponse>(
      `/readlists${buildQueryString(filters)}`,
    );
  },

  /**
   * Get single readlist by unitId
   */
  get: async (unitId: string): Promise<ReadlistResponse> => {
    return apiFetch<ReadlistResponse>(`/readlists/${unitId}`);
  },

  /**
   * Search readlists by query and filters
   */
  search: async (
    query: string,
    filters?: ReadlistFilters,
  ): Promise<ReadlistListResponse> => {
    return apiFetch<ReadlistListResponse>(
      `/readlists${buildQueryString({q: query, ...filters})}`,
    );
  },

  /**
   * Get readlists by user ID
   */
  getByUserId: async (
    userId: string,
    filters?: ReadlistFilters,
  ): Promise<ReadlistListResponse> => {
    return apiFetch<ReadlistListResponse>(
      `/readlists${buildQueryString({userId, ...filters})}`,
    );
  },

  /**
   * Create new readlist
   */
  create: async (input: CreateReadlistInput): Promise<ReadlistResponse> => {
    return apiFetch<ReadlistResponse>('/readlists', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing readlist
   */
  update: async (
    unitId: string,
    input: UpdateReadlistInput,
  ): Promise<ReadlistResponse> => {
    return apiFetch<ReadlistResponse>(`/readlists/${unitId}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete readlist
   */
  remove: async (unitId: string): Promise<{message: string}> => {
    return apiFetch<{message: string}>(`/readlists/${unitId}`, {
      method: 'DELETE',
    });
  },
};
