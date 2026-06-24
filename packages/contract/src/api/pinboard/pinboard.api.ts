import type {
  PinboardAdminReadResponse,
  PinboardOkResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

const HOME_PINBOARD_KEY = "home";

export const pinboardApi = {
  read: async (
    realmId: string,
    key = HOME_PINBOARD_KEY,
  ): Promise<PinboardReadResponse> => {
    return apiFetch<PinboardReadResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(key)}`,
    );
  },

  readAdmin: async (
    realmId: string,
    key = HOME_PINBOARD_KEY,
  ): Promise<PinboardAdminReadResponse> => {
    return apiFetch<PinboardAdminReadResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(key)}/admin`,
    );
  },

  append: async (
    realmId: string,
    key: string,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(key)}`,
      {
        method: "POST",
        body: JSON.stringify({ unitId }),
      },
    );
  },

  reorder: async (
    realmId: string,
    key: string,
    unitIds: string[],
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(key)}/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ unitIds }),
      },
    );
  },

  remove: async (
    realmId: string,
    key: string,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(key)}/${unitId}`,
      { method: "DELETE" },
    );
  },
};
