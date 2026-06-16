import { zonePortalQueryOptions, zoneQueryOptions } from "@rezics/api";
import { useQuery } from "@tanstack/react-query";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

type ZonePortalLocator =
  | {
      slug: string;
      unitId?: never;
    }
  | {
      slug?: never;
      unitId: string;
    };

/**
 * Portal data is keyed by unitId while routes are slug-canonical, so the
 * slug route chains slug → zone → portal (zone + ref-unit summaries), while
 * the unitId route enters the same portal read directly.
 * 门户数据以 unitId 为键，而路由以 slug 为正则入口，因此门户读取按
 * slug → zone → 门户（zone + 引用 Unit 摘要）链式获取；unitId 路由
 * 则直接进入同一个门户读取。
 */
export function useZonePortal(locator: ZonePortalLocator, pageSlug = "home") {
  const readContext = useReadLanguageContext();
  const slug = locator.slug ?? "";
  const zoneQuery = useQuery({
    ...zoneQueryOptions(slug, readContext.languages),
    enabled: readContext.ready && locator.slug !== undefined && !!slug,
  });
  const unitId = locator.unitId ?? zoneQuery.data?.unitId ?? "";
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
      (locator.slug !== undefined && zoneQuery.isLoading) ||
      (!!unitId && portalQuery.isLoading),
    error: zoneQuery.error ?? portalQuery.error,
  };
}
