import { subjectAttributionQueries } from "@rezics/api/subject-attribution/subject-attribution";
import { defaultSupportLanguage } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";

export function useEntityWorks(entityUnitId: string): {
  works: Array<{ unitId: string; type: string; title: string; role: string }>;
  isLoading: boolean;
} {
  const query = useQuery(
    subjectAttributionQueries.bySubject(entityUnitId, {
      status: "PUBLISHED",
      visibility: "PUBLIC",
    }),
  );

  const works =
    query.data?.flatMap((row) => {
      if (!row.unit) return [];
      const fallbackLanguage =
        defaultSupportLanguage(row.unit.supportLanguages) ??
        row.unit.resolvedLanguage;
      const title =
        row.unit.translations?.find(
          (translation) => translation.language === fallbackLanguage,
        )?.title ??
        row.unit.translations?.[0]?.title ??
        row.unit.id;
      return [
        {
          unitId: row.unit.id,
          type: row.unit.type,
          title,
          role: row.role,
        },
      ];
    }) ?? [];

  return { works, isLoading: query.isLoading };
}
