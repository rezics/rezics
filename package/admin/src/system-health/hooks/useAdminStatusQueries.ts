import { useMeiliStatusQuery, useSystemStatusQuery } from "@rezics/api";

export function useAdminSystemStatusQuery() {
  return useSystemStatusQuery();
}

export function useAdminMeiliStatusQuery() {
  return useMeiliStatusQuery();
}
