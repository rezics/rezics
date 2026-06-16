import type { RealmSidebar } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const realmSidebarApi = {
  read: async (realmId: string): Promise<RealmSidebar> => {
    return apiFetch<RealmSidebar>(`/realm/${realmId}/sidebar`);
  },

  update: async (
    realmId: string,
    sidebar: RealmSidebar,
  ): Promise<RealmSidebar> => {
    return apiFetch<RealmSidebar>(`/realm/${realmId}/sidebar`, {
      method: "PUT",
      body: JSON.stringify(sidebar),
    });
  },
};
