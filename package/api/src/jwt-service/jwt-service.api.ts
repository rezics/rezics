import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  JwtServiceListResponse,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const jwtServiceApi = {
  list: async (): Promise<JwtServiceListResponse> => {
    return apiFetch<JwtServiceListResponse>("/admin/jwt-services");
  },

  fetch: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return apiFetch<JwtServiceDTO>(`/admin/jwt-services/${serviceKey}`);
  },

  create: async (input: CreateJwtServiceInput): Promise<JwtServiceDTO> => {
    return apiFetch<JwtServiceDTO>("/admin/jwt-services", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    serviceKey: string,
    input: UpdateJwtServiceInput,
  ): Promise<JwtServiceDTO> => {
    return apiFetch<JwtServiceDTO>(`/admin/jwt-services/${serviceKey}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  activate: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return apiFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}/activate`,
      { method: "POST" },
    );
  },

  deactivate: async (serviceKey: string): Promise<JwtServiceDTO> => {
    return apiFetch<JwtServiceDTO>(
      `/admin/jwt-services/${serviceKey}/deactivate`,
      { method: "POST" },
    );
  },
};
