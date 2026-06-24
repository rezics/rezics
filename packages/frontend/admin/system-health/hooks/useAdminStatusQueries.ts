import {
  useMeiliStatusQuery,
  useSystemStatusQuery,
} from "@rezics/contract/api";

export function useAdminSystemStatusQuery() {
  return useSystemStatusQuery();
}

export function useAdminMeiliStatusQuery() {
  return useMeiliStatusQuery();
}
