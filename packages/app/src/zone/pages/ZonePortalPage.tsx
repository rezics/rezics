import { useServerPermission } from "@rezics/contract/api/hooks/useServerPermission";
import { myRealmMembershipQuery } from "@rezics/contract/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { ZoneSectionList } from "../components/sections/ZoneSectionList";
import { ZoneHeader } from "../components/ZoneHeader";
import { useZonePortal } from "../hooks/useZone";
import { canManageZone } from "../models/canManageZone";
import { selectZoneDynamicTags } from "../models/zoneDynamicTags";
import {
  type ZoneRouteLocation,
  zoneManageHref,
  zoneRouteLocationFromZone,
} from "../models/zoneMenu";
import {
  ZONE_CONTENT_MAX_WIDTH_DEFAULT,
  zoneThemeCssVars,
} from "../models/zoneTheme";

type ZonePortalPageProps = {
  pageSlug?: string;
} & (
  | {
      slug: string;
      unitId?: never;
    }
  | {
      slug?: never;
      unitId: string;
    }
);

/**
 * Single config-driven portal: renders `config.pages.home.sections`
 * through the section primitives — template dispatch is dead.
 * 单一的配置驱动门户：通过分区原语渲染 `config.pages.home.sections`
 * ——模板分发已废弃。
 *
 * Layout responsive design with custom zone theming (CSS var injection):
 * - Mobile (<640px): Full-width single column, theme background with px-4 padding
 * - Tablet (640-1023px): Same as mobile with max-width constraint
 * - Desktop (1024-1535px): Max-width 4xl centered content, zone header full-width
 * - Ultra-wide (≥1536px): Same as desktop with wider viewport
 *
 * Mobile (<640px):
 * ┌───────────────────────────┐
 * │ [Zone Background]         │
 * │ ┌─────────────────────┐   │
 * │ │ Zone Header         │   │
 * │ │ [Logo] Zone Name    │   │
 * │ │ Description...      │   │
 * │ └─────────────────────┘   │
 * │ ┌─────────────────────┐   │
 * │ │ [Manage] (if auth)  │   │ (right-aligned)
 * │ └─────────────────────┘   │
 * │ ┌─────────────────────┐   │
 * │ │ Hero Section        │   │ (config-driven sections)
 * │ │ [Banner image]      │   │
 * │ │ [CTA buttons]       │   │
 * │ └─────────────────────┘   │
 * │ ┌─────────────────────┐   │
 * │ │ Collection Section  │   │
 * │ │ [Item grid]         │   │
 * │ └─────────────────────┘   │
 * │ ┌─────────────────────┐   │
 * │ │ Feed Section        │   │
 * │ │ [Posts list]        │   │
 * │ └─────────────────────┘   │
 * └───────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌───────────────────────────────┐
 * │      [Zone Background]        │
 * │      ┌───────────────────┐    │
 * │      │ Zone Header       │    │
 * │      │ [Logo] Zone Name  │    │
 * │      │ Description...    │    │
 * │      └───────────────────┘    │
 * │      [Manage] (right-aligned) │
 * │      ┌───────────────────┐    │
 * │      │ Hero Section      │    │
 * │      │ [Banner]          │    │
 * │      │ [CTAs]            │    │
 * │      └───────────────────┘    │
 * │      ┌───────────────────┐    │
 * │      │ Collections       │    │
 * │      │ [Grid items]      │    │
 * │      └───────────────────┘    │
 * │      ┌───────────────────┐    │
 * │      │ Feed              │    │
 * │      │ [Posts]           │    │
 * │      └───────────────────┘    │
 * └───────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ [Zone Background (theme colors)]           │
 * │ ┌──────────────────────────────────────┐   │
 * │ │ Zone Header (full width)             │   │
 * │ │ [Logo] Zone Name                     │   │
 * │ │ Description text...                  │   │
 * │ └──────────────────────────────────────┘   │
 * │                                            │
 * │ ┌──────────────────────────────────────┐   │
 * │ │ [Manage Link] (right-aligned)        │   │
 * │ └──────────────────────────────────────┘   │
 * │                                            │
 * │ ┌──────────────────────────────────────┐   │
 * │ │ Hero Section                         │   │
 * │ │ [Banner with image] [CTA buttons]    │   │
 * │ └──────────────────────────────────────┘   │
 * │                                            │
 * │ ┌──────────────────────────────────────┐   │
 * │ │ Collection Section                   │   │
 * │ │ [Item grid layout]                   │   │
 * │ └──────────────────────────────────────┘   │
 * │                                            │
 * │ ┌──────────────────────────────────────┐   │
 * │ │ Feed Section                         │   │
 * │ │ [Posts timeline]                     │   │
 * │ └──────────────────────────────────────┘   │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (≥1536px):
 * ┌──────────────────────────────────────────────────────────┐
 * │ [Padding] [Zone Background (theme colors)]  [Padding]   │
 * │           ┌────────────────────────────┐                │
 * │           │ Zone Header                │                │
 * │           │ [Logo] Zone Name           │                │
 * │           │ Description...             │                │
 * │           └────────────────────────────┘                │
 * │                                                          │
 * │           ┌────────────────────────────┐                │
 * │           │ [Manage] (right-aligned)   │                │
 * │           └────────────────────────────┘                │
 * │                                                          │
 * │           ┌────────────────────────────┐                │
 * │           │ Hero Section               │                │
 * │           │ [Wide content area]        │                │
 * │           └────────────────────────────┘                │
 * │                                                          │
 * │           ┌────────────────────────────┐                │
 * │           │ Collections/Feed/etc       │                │
 * │           │ [Config-driven sections]   │                │
 * │           └────────────────────────────┘                │
 * └──────────────────────────────────────────────────────────┘
 */
export const ZonePortalPage: React.FC<ZonePortalPageProps> = ({
  slug,
  unitId,
  pageSlug = "home",
}) => {
  const { t } = useTranslation(["zone"]);
  const locator = slug ? { slug } : { unitId: unitId ?? "" };
  const { zone, page, refUnits, languages, appLocale, isLoading, error } =
    useZonePortal(locator, pageSlug);
  const [dynamicTagSeed] = useState(() => `${Date.now()}:${Math.random()}`);
  const dynamicTagSelections = useMemo(
    () =>
      page ? selectZoneDynamicTags(page.config.sections, dynamicTagSeed) : {},
    [dynamicTagSeed, page],
  );
  const permission = useServerPermission();
  const membershipQuery = useQuery({
    ...myRealmMembershipQuery(zone?.ownerRealmUnitId ?? ""),
    enabled: Boolean(zone?.ownerRealmUnitId),
  });
  const showManage = canManageZone({
    permission,
    ownerRealmMemberRoleKey: membershipQuery.data?.roleKey,
  });

  if (isLoading) {
    return (
      <div className="w-full mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-text-secondary">{t("zone:loading")}</p>
      </div>
    );
  }

  if (error || !zone || !page || !refUnits) {
    return (
      <div className="w-full mx-auto max-w-4xl px-4 py-24 text-center">
        <h2 className="mb-2 text-2xl font-semibold leading-ui text-text-primary">
          {t("zone:not_found")}
        </h2>
        <p className="text-text-secondary">{t("zone:not_found_description")}</p>
      </div>
    );
  }

  const themeVars = zoneThemeCssVars(zone.theme) as CSSProperties;
  const routeLocation: ZoneRouteLocation = zoneRouteLocationFromZone(
    slug ? { ...zone, slug } : { ...zone, slug: null },
  );
  const contentStyle = {
    maxWidth: `var(--zone-content-max-width, ${ZONE_CONTENT_MAX_WIDTH_DEFAULT}px)`,
  } satisfies CSSProperties;

  return (
    <div
      style={{
        ...themeVars,
        // Theme background token; invalid/absent values fall through to
        // the canvas surface.
        // 主题背景 token；无效或缺失的值回落到画布表面。
        backgroundColor: "var(--zone-color-background)",
      }}
      className="min-h-full"
    >
      <ZoneHeader
        zone={zone}
        refUnits={refUnits}
        routeLocation={routeLocation}
      />
      <div className="mx-auto w-full px-4 py-8" style={contentStyle}>
        {showManage ? (
          <div className="mb-6 flex justify-end">
            <SafeLink
              href={zoneManageHref(routeLocation)}
              className="rounded-md bg-surface-subtle px-3 py-2 text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-sunken"
            >
              {t("zone:manage")}
            </SafeLink>
          </div>
        ) : null}
        <ZoneSectionList
          sections={page.config.sections}
          ctx={{
            zone,
            pageId: page.id,
            refUnits,
            languages,
            appLocale,
            dynamicTagSelections,
          }}
        />
      </div>
    </div>
  );
};
