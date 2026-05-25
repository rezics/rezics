import { useMeiliStatusQuery, useSystemStatusQuery } from "@rezics/api";
import { useServerPermission } from "@rezics/api/hooks";
import { isAdminStatusRole } from "../models/status";

export function useCanViewStatus() {
  const permission = useServerPermission();
  return isAdminStatusRole(permission?.role);
}

export function useSystemStatusData() {
  return useSystemStatusQuery();
}

export function useMeiliStatusData() {
  return useMeiliStatusQuery();
}
