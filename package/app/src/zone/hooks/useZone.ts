import { zonePortalQueryOptions, zoneQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

/**
 * Portal data is keyed by unitId while routes are slug-canonical, so the
 * portal read chains slug → zone → portal (zone + ref-unit summaries).
 * 门户数据以 unitId 为键，而路由以 slug 为正则入口，因此门户读取按
 * slug → zone → 门户（zone + 引用 Unit 摘要）链式获取。
 */
export function useZonePortal(slug: string, pageSlug = "home") {
  const readContext = useReadLanguageContext();
  const zoneQuery = useQuery({
    ...zoneQueryOptions(slug, readContext.languages),
    enabled: readContext.ready && !!slug,
  });
  const unitId = zoneQuery.data?.unitId ?? "";
  const portalQuery = useQuery({
    ...zonePortalQueryOptions(unitId, pageSlug, readContext.languages),
    enabled: readContext.ready && !!unitId && !!pageSlug,
  });

  return {
    zone: portalQuery.data?.zone,
    page: portalQuery.data?.page,
    refUnits: portalQuery.data?.refUnits,
    languages: readContext.languages,
    isLoading:
      !readContext.ready ||
      zoneQuery.isLoading ||
      (!!unitId && portalQuery.isLoading),
    error: zoneQuery.error ?? portalQuery.error,
  };
}
