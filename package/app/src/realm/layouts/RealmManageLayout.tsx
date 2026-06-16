import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import type { TagTreeNode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Tabs, TabsList, TabsTrigger } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { QueryErrorDisplay } from "@/core";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { canManageRealm } from "../models/canManageRealm";
import type { RealmDetailRouteLocation } from "../models/realmDetailRoutes";
import {
  REALM_MANAGE_PAGES,
  realmManagePageFromPathname,
  realmManagePageHref,
  type RealmManagePageKey,
} from "../models/realmManageRoutes";
import { RealmManageProvider } from "./realmManageContext";

type RealmManageLayoutProps = {
  realmId: string;
  routeLocation?: RealmDetailRouteLocation;
};

/**
 * Realm management route shell. It owns the shared realm query, permission
 * guard, navigation chrome, and nested route outlet; leaf manage pages own the
 * actual editing workflows.
 *
 * 管理页共享布局：持有 realm 查询、权限守卫、导航外壳与子路由出口；具体编辑
 * 工作流交给 `pages/manage/*` 的路由页。
 *
 * Mobile (<640px):
 * ┌──────────────────────────┐
 * │ Realm Management         │
 * │ [Profile][Org][Wiki] ->  │
 * │ [Outlet page content]    │
 * └──────────────────────────┘
 *
 * Tablet (640-1023px):
 * ┌────────────────────────────────────┐
 * │ Realm Management                   │
 * │ [Profile][Org][Wiki][Mod] ->       │
 * │ [Outlet page content]              │
 * └────────────────────────────────────┘
 *
 * Desktop (1024-1535px):
 * ┌────────────────────────────────────────────┐
 * │ Realm Management                           │
 * │ [Profile][Organization][Wiki][Moderation] │
 * │ [Outlet page content - max width 5xl]      │
 * └────────────────────────────────────────────┘
 *
 * Ultra-wide (>=1536px):
 * ┌────────────────────────────────────────────┐
 * │             centered max width 5xl         │
 * │ Realm Management + horizontal nav + page   │
 * └────────────────────────────────────────────┘
 */
export function RealmManageLayout({
  realmId,
  routeLocation = { kind: "unitId", realmId },
}: RealmManageLayoutProps) {
  const { t } = useTranslation(["common", "entity", "community"]);
  const navigate = useNavigate();
  const { location } = useRouterState();
  const readContext = useReadLanguageContext();
  const {
    data: realm,
    error: realmError,
    isError: realmIsError,
    isLoading,
  } = useQuery({
    ...realmDetailQuery(realmId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const { data: membership, isLoading: membershipLoading } = useQuery(
    myRealmMembershipQuery(realmId),
  );
  const permission = useServerPermission();
  const allowed = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });

  useEffect(() => {
    if (!isLoading && !membershipLoading && !allowed) {
      navigate({
        to:
          routeLocation.kind === "slug"
            ? `/r/${routeLocation.realmSlug}`
            : `/realm/${routeLocation.realmId}`,
        replace: true,
      });
    }
  }, [isLoading, membershipLoading, allowed, navigate, routeLocation]);

  if (isLoading || membershipLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (realmIsError) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <QueryErrorDisplay error={realmError} />
      </div>
    );
  }

  if (!realm) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6 text-sm leading-body text-text-secondary">
          {t("community:realm_settings_unavailable")}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        <div className="rounded-md bg-surface-subtle p-6">
          <h1 className="text-lg font-semibold leading-ui text-text-primary">
            {t("community:realm_management_unavailable")}
          </h1>
          <p className="mt-2 text-sm leading-body text-text-secondary">
            {t("community:realm_management_permission_required")}
          </p>
        </div>
      </div>
    );
  }

  const activePage = realmManagePageFromPathname(
    location.pathname,
  ) as RealmManagePageKey;
  const canDeleteRealm =
    membership?.roleKey === "owner" ||
    membership?.roleKey === "admin" ||
    permission?.role === "ROOT";

  return (
    <RealmManageProvider
      value={{
        realmId,
        routeLocation,
        realm,
        memberRoleKey: membership?.roleKey ?? undefined,
        canDeleteRealm,
        tagTree: realm.extra?.tagTree as TagTreeNode[] | undefined,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-semibold leading-ui text-text-primary">
          {t("entity:realm_manage")}
        </h1>
        <Tabs
          value={activePage}
          onValueChange={(value) => {
            void navigate({
              to: realmManagePageHref(
                routeLocation,
                value as RealmManagePageKey,
              ),
            });
          }}
        >
          <TabsList className="mb-6 flex w-full max-w-full justify-start overflow-x-auto overscroll-x-contain">
            {REALM_MANAGE_PAGES.map((page) => (
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
    </RealmManageProvider>
  );
}
