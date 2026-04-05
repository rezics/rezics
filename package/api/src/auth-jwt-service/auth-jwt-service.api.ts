import type {
  JwtServiceDTO,
  JwtServiceListResponse,
  CreateJwtServiceInput,
  UpdateJwtServiceInput,
} from '@rezics/contract';
import {getApiConfig} from '../config';

function getAuthBaseUrl(): string {
  return getApiConfig().authBaseUrl;
}

async function authAdminFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${getAuthBaseUrl()}/api/auth${endpoint}`;
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(new Headers(options?.headers).entries()),
    },
  });

  const json = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      JSON.stringify({
        status: response.status,
        message: json?.message ?? response.statusText,
      }),
    );
  }

  return json as T;
}

export const authJwtServiceApi = {
  list: async (): Promise<JwtServiceListResponse> => {
    return authAdminFetch<JwtServiceListResponse>('/admin/jwt-services');
  },

  fetch: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return authAdminFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}`,
    );
  },

  create: async (input: CreateJwtServiceInput): Promise<JwtServiceDTO> => {
    return authAdminFetch<JwtServiceDTO>('/admin/jwt-services', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  update: async (
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> => {
    return authAdminFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}`,
      {
        method: 'PATCH',
        body: JSON.stringify(input),
      },
    );
  },

  activate: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return authAdminFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}/activate`,
      {method: 'POST'},
    );
  },

  deactivate: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return authAdminFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}/deactivate`,
      {method: 'POST'},
    );
  },
};
