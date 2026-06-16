import type { RealmDock } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const realmDockApi = {
  read: async (realmId: string): Promise<RealmDock> => {
    return apiFetch<RealmDock>(`/realm/${realmId}/dock`);
  },

  update: async (realmId: string, dock: RealmDock): Promise<RealmDock> => {
    return apiFetch<RealmDock>(`/realm/${realmId}/dock`, {
      method: "PUT",
      body: JSON.stringify(dock),
    });
  },
};
