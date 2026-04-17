import { queryOptions } from "@tanstack/react-query";
import { translationGroupApi } from "./translation-group.api";
import { translationGroupKeys } from "./translation-group.keys";

export const translationGroupSiblingsQuery = (unitId: string | null | undefined) =>
  queryOptions({
    queryKey: translationGroupKeys.siblings(unitId ?? ""),
    queryFn: () => translationGroupApi.listSiblings(unitId!),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });
