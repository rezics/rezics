import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import type React from "react";
import type { CSSProperties } from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { ZoneSectionList } from "../components/sections/ZoneSectionList";
import { ZoneHeader } from "../components/ZoneHeader";
import { useZonePortal } from "../hooks/useZone";
import { canManageZone } from "../models/canManageZone";
import {
  ZONE_CONTENT_MAX_WIDTH_DEFAULT,
  zoneThemeCssVars,
} from "../models/zoneTheme";

type ZonePortalPageProps = {
  slug: string;
  pageSlug?: string;
};

/**
 * Single config-driven portal: renders `config.pages.home.sections`
 * through the section primitives — template dispatch is dead.
 * 单一的配置驱动门户：通过分区原语渲染 `config.pages.home.sections`
 * ——模板分发已废弃。
 */
export const ZonePortalPage: React.FC<ZonePortalPageProps> = ({
  slug,
  pageSlug = "home",
}) => {
  const { t } = useTranslation(["zone"]);
  const { zone, page, refUnits, languages, isLoading, error } = useZonePortal(
    slug,
    pageSlug,
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
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <p className="text-text-secondary">{t("zone:loading")}</p>
      </div>
    );
  }

  if (error || !zone || !page || !refUnits) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-24 text-center">
        <h2 className="mb-2 text-2xl font-semibold leading-ui text-text-primary">
          {t("zone:not_found")}
        </h2>
        <p className="text-text-secondary">{t("zone:not_found_description")}</p>
      </div>
    );
  }

  const themeVars = zoneThemeCssVars(zone.theme) as CSSProperties;
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
      <ZoneHeader zone={zone} refUnits={refUnits} />
      <div className="mx-auto w-full px-4 py-8" style={contentStyle}>
        {showManage ? (
          <div className="mb-6 flex justify-end">
            <SafeLink
              href={`/z/${zone.slug}/manage`}
              className="rounded-md bg-surface-subtle px-3 py-2 text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-sunken"
            >
              {t("zone:manage")}
            </SafeLink>
          </div>
        ) : null}
        <ZoneSectionList
          sections={page.config.sections}
          ctx={{ zone, pageId: page.id, refUnits, languages }}
        />
      </div>
    </div>
  );
};
