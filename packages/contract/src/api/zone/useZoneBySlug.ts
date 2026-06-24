import { useQuery } from "@tanstack/react-query";
import { zoneQueryOptions } from "./zone.queries";

export function useZoneBySlug(
  zoneSlug: string,
  languages: readonly string[] = [],
) {
  return useQuery(zoneQueryOptions(zoneSlug, languages));
}
