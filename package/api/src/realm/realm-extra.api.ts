import type {
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const realmExtraApi = {
  /**
   * `GET /realm/:realmId/extra/:key` — public stale-filtered read of a
   * Realm.extra ordered list.
   */
  read: async (
    realmId: string,
    key: string,
  ): Promise<RealmExtraReadResponse> => {
    return apiFetch<RealmExtraReadResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}`,
    );
  },

  /**
   * `GET /realm/:realmId/extra/:key/admin` — admin read that returns the full
   * stored array plus a parallel `staleIds` list.
   */
  readAdmin: async (
    realmId: string,
    key: string,
  ): Promise<RealmExtraAdminReadResponse> => {
    return apiFetch<RealmExtraAdminReadResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}/admin`,
    );
  },

  append: async (
    realmId: string,
    key: string,
    unitId: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}/append`,
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
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}/reorder`,
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
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmId}/extra/${encodeURIComponent(key)}/${unitId}`,
      { method: "DELETE" },
    );
  },
};
