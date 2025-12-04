/**
 * Token API client functions
 * Thin wrappers around the HTTP endpoints exposed by the backend.
 */

import type {
  ApiTokenDTO,
  ApiTokenListResponse,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
} from '@package/contract';
import {apiFetch} from '../react-query/http';

/**
 * Token API methods
 */
export const tokenApi = {
  /**
   * List all non-revoked tokens for the current user.
   */
  list: async (): Promise<ApiTokenListResponse> => {
    return apiFetch<ApiTokenListResponse>('/token/tokens');
  },

  /**
   * Create a new API token for the current user.
   * The raw token string is only returned once in the response.
   */
  create: async (
    input: CreateApiTokenInput,
  ): Promise<CreateApiTokenResponse> => {
    return apiFetch<CreateApiTokenResponse>('/token/tokens', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  /**
   * Update token metadata (name, scopes, expiration).
   */
  update: async (
    id: string,
    input: UpdateApiTokenInput,
  ): Promise<ApiTokenDTO> => {
    return apiFetch<ApiTokenDTO>(`/token/tokens/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  },

  /**
   * Revoke an API token so it can no longer be used.
   */
  revoke: async (id: string): Promise<{message: string}> => {
    return apiFetch<{message: string}>(`/token/tokens/${id}`, {
      method: 'DELETE',
    });
  },
};


