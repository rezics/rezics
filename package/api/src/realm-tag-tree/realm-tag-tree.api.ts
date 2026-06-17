import type {
  RealmTagTreeReadResponse,
  UpdateRealmTagTreeInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const realmTagTreeApi = {
  get: async (realmId: string): Promise<RealmTagTreeReadResponse> => {
    return apiFetch<RealmTagTreeReadResponse>(
      `/realm/${encodeURIComponent(realmId)}/tag-tree`,
    );
  },

  update: async (
    realmId: string,
    input: UpdateRealmTagTreeInput,
  ): Promise<RealmTagTreeReadResponse> => {
    return apiFetch<RealmTagTreeReadResponse>(
      `/realm/${encodeURIComponent(realmId)}/tag-tree`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },
};
