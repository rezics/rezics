import { zoneQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";

export function useZone(slug: string) {
  const { data, isLoading, error } = useQuery(zoneQueryOptions(slug));

  return {
    zone: data,
    isLoading,
    error,
  };
}
