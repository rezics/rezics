import { zonePortalQueryOptions, zoneQueryOptions } from "@rezics/contract/api/zone/zone.queries";
import { useServerPermission } from "@rezics/contract/api/hooks/useServerPermission";
import { myRealmMembershipQuery } from "@rezics/contract/api/realm/realm.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryErrorDisplay } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { canManageZone } from "../models/canManageZone";
import {
  type ZoneRouteLocation,
  zoneRouteBaseHref,
} from "../models/zoneDetailRoutes";
import {
  ZONE_MANAGE_PAGES,
  type ZoneManagePageKey,
  zoneManagePageFromPathname,
  zoneManagePageHref,
} from "../models/zoneManageRoutes";
import { ZoneManageProvider } from "./zoneManageContext";

type ZoneManageLayoutProps =
  | {
      unitId: string;
      slug?: never;
      routeLocation: Extract<ZoneRouteLocation, { kind: "unitId" }>;
    }
  | {
      unitId?: never;
      slug: string;
      routeLocation: Extract<ZoneRouteLocation, { kind: "slug" }>;
    };

/**
 * Zone management route shell. It resolves the zone, checks owner-realm
 * management permission, renders persistent navigation, and lets nested route
 * pages own their isolated draft/save workflows.
 *
 * Zone 管理页共享布局：解析 zone、检查 owner realm 管理权限、渲染持久导航，
 * 子路由页各自持有独立 draft 与保存流程。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Zone Management · name   │
 * │ [Profile][Pages] ->      │
 * │ [Outlet page content]    │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Zone Management · name             │
 * │ [Profile][Pages][Sources] ->       │
 * │ [Outlet page content]              │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Zone Management · name                     │
 * │ [Profile][Pages][Sources][Menus][Theme]   │
 * │ [Outlet page content - max width 5xl]      │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │             centered max width 5xl         │
 * │ Zone management nav and route content      │
 * └────────────────────────────────────────────┘
 */
export function ZoneManageLayout({
  unitId,
  slug,
  routeLocation,
}: ZoneManageLayoutProps) {
  const { t } = useTranslation(["zone"]);
  const navigate = useNavigate();
  const { location } = useRouterState();
  const readContext = useReadLanguageContext();
  const readQuery = {
    languages: readContext.languages,
    appLocale: readContext.appLocale,
  };
  const bySlugQuery = useQuery({
    ...zoneQueryOptions(slug ?? "", readQuery),
    enabled: readContext.ready && !unitId && !!slug,
  });
  const resolvedUnitId = unitId ?? bySlugQuery.data?.unitId ?? "";
  const portalQuery = useQuery({
    ...zonePortalQueryOptions(resolvedUnitId, "home", readQuery),
    enabled: readContext.ready && !!resolvedUnitId,
  });
  const zone =
    portalQuery.data?.zone ?? (unitId ? undefined : bySlugQuery.data);
  const refUnits = portalQuery.data?.refUnits ?? {};
  const membershipQuery = useQuery({
    ...myRealmMembershipQuery(zone?.ownerRealmUnitId ?? ""),
    enabled: Boolean(zone?.ownerRealmUnitId),
  });
  const permission = useServerPermission();
  const allowed = canManageZone({
    permission,
    ownerRealmMemberRoleKey: membershipQuery.data?.roleKey,
  });
  const isLoading =
    !readContext.ready ||
    (unitId ? portalQuery.isLoading : bySlugQuery.isLoading) ||
    (!!resolvedUnitId && portalQuery.isLoading) ||
    membershipQuery.isLoading;
  const isError = unitId ? portalQuery.isError : bySlugQuery.isError;
  const error = unitId ? portalQuery.error : bySlugQuery.error;

  useEffect(() => {
    if (!isLoading && zone && !allowed) {
      navigate({
        to: zoneRouteBaseHref(routeLocation),
        replace: true,
      });
    }
  }, [allowed, isLoading, navigate, routeLocation, zone]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <QueryErrorDisplay error={error} />
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          {t("zone:not_found_description")}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            {t("zone:manage")}
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            {t("zone:manage_denied")}
          </p>
        </div>
      </div>
    );
  }

  const homePage = portalQuery.data?.page;
  if (!homePage) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          {t("zone:not_found_description")}
        </div>
      </div>
    );
  }

  const activePage = zoneManagePageFromPathname(
    location.pathname,
  ) as ZoneManagePageKey;

  return (
    <ZoneManageProvider
      value={{
        routeLocation,
        zone,
        refUnits,
        readQuery,
        homePageId: homePage.id,
        homePageConfig: homePage.config,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold leading-ui text-text-primary">
            {t("zone:manage")} · {zone.name || zone.slug}
          </h1>
        </div>
        <Tabs
          value={activePage}
          onValueChange={(value) => {
            void navigate({
              to: zoneManagePageHref(routeLocation, value as ZoneManagePageKey),
            });
          }}
        >
          <TabsList className="mb-6 flex w-full max-w-full justify-start overflow-x-auto overscroll-x-contain">
            {ZONE_MANAGE_PAGES.map((page) => (
              <TabsTrigger
                key={page.key}
                value={page.key}
                className="flex-none"
              >
                {t(page.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Outlet />
      </div>
    </ZoneManageProvider>
  );
}
