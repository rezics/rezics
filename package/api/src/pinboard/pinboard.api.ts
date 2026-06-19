import type {
  PinboardAdminReadResponse,
  PinboardOkResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

const HOME_PINBOARD_PLACEMENT = "home";

export const pinboardApi = {
  read: async (
    realmId: string,
    placement = HOME_PINBOARD_PLACEMENT,
  ): Promise<PinboardReadResponse> => {
    return apiFetch<PinboardReadResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(placement)}`,
    );
  },

  readAdmin: async (
    realmId: string,
    placement = HOME_PINBOARD_PLACEMENT,
  ): Promise<PinboardAdminReadResponse> => {
    return apiFetch<PinboardAdminReadResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(placement)}/admin`,
    );
  },

  append: async (
    realmId: string,
    placement: string,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(placement)}`,
      {
        method: "POST",
        body: JSON.stringify({ unitId }),
      },
    );
  },

  reorder: async (
    realmId: string,
    placement: string,
    unitIds: string[],
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(placement)}/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ unitIds }),
      },
    );
  },

  remove: async (
    realmId: string,
    placement: string,
    unitId: string,
  ): Promise<PinboardOkResponse> => {
    return apiFetch<PinboardOkResponse>(
      `/realm/${realmId}/pinboards/${encodeURIComponent(placement)}/${unitId}`,
      { method: "DELETE" },
    );
  },
};
