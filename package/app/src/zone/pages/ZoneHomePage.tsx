import { useServerPermission } from "@rezics/api/hooks";
import { myRealmMembershipQuery } from "@rezics/api/realm/realm";
import { zoneHomepageByUnitIdQueryOptions } from "@rezics/api/zone/zone";
import { useLocale, useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";
import { useZone } from "../hooks/useZone";
import { canManageZone } from "../models/canManageZone";
import { BookZoneTemplate } from "../templates/book";
import { DefaultZoneTemplate } from "../templates/default";
import {
  WikiClassicZoneTemplate,
  WikiDatabaseZoneTemplate,
  WikiMediaZoneTemplate,
  WikiMinimalZoneTemplate,
} from "../templates/wiki";

export type ZoneHomePageProps = {
  slug: string;
};

const templates: Record<string, React.FC<any>> = {
  default: DefaultZoneTemplate,
  book: BookZoneTemplate,
  "wiki-classic": WikiClassicZoneTemplate,
  "wiki-media": WikiMediaZoneTemplate,
  "wiki-database": WikiDatabaseZoneTemplate,
  "wiki-minimal": WikiMinimalZoneTemplate,
};

export const ZoneHomePage: React.FC<ZoneHomePageProps> = ({ slug }) => {
  const { t } = useTranslation(["search"]);
  const locale = useLocale();
  const { zone, isLoading, error } = useZone(slug);
  const navigate = useNavigate();
  const permission = useServerPermission();
  const membershipQuery = useQuery({
    ...myRealmMembershipQuery(zone?.ownerRealmUnitId ?? ""),
    enabled: Boolean(zone?.ownerRealmUnitId),
  });
  const homepageQuery = useQuery(
    zoneHomepageByUnitIdQueryOptions(zone?.unitId ?? "", [locale]),
  );
  const showManage = canManageZone({
    permission,
    ownerRealmMemberRoleKey: membershipQuery.data?.roleKey,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">{t("search:zone_loading")}</p>
      </div>
    );
  }

  if (error || !zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold mb-2">
          {t("search:zone_not_found")}
        </h2>
        <p className="text-text-secondary">
          {t("search:zone_not_found_description")}
        </p>
      </div>
    );
  }

  const templateKey = zone.wiki?.theme?.template ?? zone.template;
  const Template = templates[templateKey] ?? templates.default!;

  const handleSearch = (keyword: string) => {
    navigate({
      to: "/z/$slug/search",
      params: { slug },
      search: { q: keyword },
    });
  };

  return (
    <div className="max-w-8xl mx-auto px-4 py-8">
      {showManage ? (
        <div className="mb-4 flex justify-end">
          <SafeLink
            href={`/z/${slug}/manage`}
            className="rounded-md bg-surface-subtle px-3 py-2 text-sm font-medium leading-ui text-text-primary transition-colors hover:bg-surface-sunken"
          >
            Manage
          </SafeLink>
        </div>
      ) : null}
      <Template
        zone={zone}
        homepageData={homepageQuery.data}
        homepageLoading={homepageQuery.isLoading}
        onSearch={handleSearch}
      />
    </div>
  );
};
