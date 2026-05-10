import type { SystemShelfKindKey } from "@rezics/contract";
import { userQueries } from "@rezics/api/user/user.queries";
import { useQuery } from "@tanstack/react-query";

export type SystemShelfIdMap = Partial<Record<SystemShelfKindKey, string>>;

export type UseSystemShelfIdsResult = {
  isLoading: boolean;
  shelfIds: SystemShelfIdMap;
  getShelfId: (kindKey: SystemShelfKindKey) => string | undefined;
};

export function useSystemShelfIds(): UseSystemShelfIdsResult {
  const { data, isLoading } = useQuery(userQueries.me());
  const shelfIds: SystemShelfIdMap = data?.systemShelves ?? {};
  return {
    isLoading,
    shelfIds,
    getShelfId: (kindKey) => shelfIds[kindKey],
  };
}
