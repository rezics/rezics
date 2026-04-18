import { useQuery } from "@tanstack/react-query";
import { translationGroupSiblingsQuery } from "./translation-group.queries";

export function useTranslationGroupSiblings(unitId: string | null | undefined) {
  return useQuery(translationGroupSiblingsQuery(unitId));
}
