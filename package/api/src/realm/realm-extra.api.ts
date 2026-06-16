import type { RealmExtra, RealmExtraOkResponse } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const realmExtraApi = {
  setValue: async (
    realmId: string,
    key: string,
    value: RealmExtra[keyof RealmExtra],
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
      },
    );
  },

  clearValue: async (
    realmId: string,
    key: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}`,
      { method: "DELETE" },
    );
  },
};
