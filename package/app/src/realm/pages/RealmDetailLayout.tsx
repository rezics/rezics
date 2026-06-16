import { useServerPermission } from "@rezics/api/hooks";
import {
  myRealmMembershipQuery,
  realmDetailQuery,
} from "@rezics/api/realm/realm";
import { contentDocMarkdownFallback, type TagTreeNode } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import { Avatar, AvatarFallback, AvatarImage, Button } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, Settings } from "lucide-react";
import type { ReactNode } from "react";
import { RealmMembershipSettingsDialog } from "@/realm-tag-preference";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { JoinButton } from "../components/JoinButton";
import { canManageRealm } from "../models/canManageRealm";
import {
  type RealmDetailRouteLocation,
  realmCreateHref,
  realmManageHref,
} from "../models/realmDetailRoutes";
import { BannerSection } from "../sections/BannerSection";
import { RealmDetailShell } from "../sections/RealmDetailShell";
import { RealmDetailProvider } from "./realmDetailContext";

interface RealmDetailLayoutProps {
  realmId: string;
  routeLocation?: RealmDetailRouteLocation;
  children: ReactNode;
}

/**
 * Shared layout for all realm detail tabs. Owns the realm query, the banner +
 * header chrome, and the tab shell — so the header persists across tab routes.
 * Tab routes render into `children` (the route `<Outlet/>`) and read shared
 * realm state via `useRealmDetail`.
 * 所有 realm 详情标签共享的布局。持有 realm 查询、横幅 + 页头外壳与标签壳层，
 * 因此页头在切换标签路由时保持不变。标签路由渲染进 `children`（路由 `<Outlet/>`），
 * 并通过 `useRealmDetail` 读取共享的 realm 状态。
 */
export function RealmDetailLayout({
  realmId,
  // Public realm routes may be slug-based while API calls still use the
  // resolved realm unit id.
  routeLocation = { kind: "unitId", realmId },
  children,
}: RealmDetailLayoutProps) {
  const { t } = useTranslation(["common", "entity"]);
  const readContext = useReadLanguageContext();
  const {
    data: realm,
    isLoading,
    error,
  } = useQuery({
    ...realmDetailQuery(realmId, {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    }),
    enabled: readContext.ready,
  });
  const { data: membership } = useQuery(myRealmMembershipQuery(realmId));
  const permission = useServerPermission();

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <p className="py-8 text-center text-destructive">
        {t("common:error_generic")}
      </p>
    );
  }

  if (!realm) {
    return (
      <p className="py-8 text-text-secondary">{t("entity:realm_not_found")}</p>
    );
  }

  const title = realm.title ?? t("entity:realm_untitled");
  const description = contentDocMarkdownFallback(realm.description);
  const avatarUrl =
    realm.extra?.avatar?.kind === "url" ? realm.extra.avatar.url : undefined;
  const tagTree = realm.extra?.tagTree as TagTreeNode[] | undefined;
  const showManage = canManageRealm({
    permission,
    memberRoleKey: membership?.roleKey,
  });
  const isMember = Boolean(membership?.member);

  return (
    <RealmDetailProvider
      value={{
        realmId,
        routeLocation,
        realm,
        membership,
        isMember,
        showManage,
        tagTree,
        description,
      }}
    >
      <div className="mx-auto w-full max-w-5xl px-4 py-6">
        <BannerSection banner={realm.extra?.banner ?? null} />
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-row items-center gap-3">
              <Avatar className="size-14 rounded-md bg-surface-subtle">
                <AvatarImage src={avatarUrl} alt="" />
                <AvatarFallback className="rounded-md text-lg leading-ui">
                  {title.trim().slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-row items-center gap-2">
                <h1 className="truncate text-2xl font-semibold">{title}</h1>
                {showManage && (
                  <Link to={realmManageHref(routeLocation)}>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("entity:realm_manage")}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isMember ? (
                <Link to={realmCreateHref(routeLocation)}>
                  <Button size="sm" className="gap-1 rounded-full px-2 md:px-4">
                    <Plus className="h-4 w-4" />
                    {t("common:create")}
                  </Button>
                </Link>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  {t("entity:realm_join_to_post")}
                </Button>
              )}
              {isMember ? (
                <RealmMembershipSettingsDialog
                  realmId={realmId}
                  realmTitle={title}
                />
              ) : (
                <JoinButton realmId={realmId} />
              )}
            </div>
          </div>
          {description && (
            <p className="text-base text-text-secondary">{description}</p>
          )}
          <div className="flex flex-row gap-4">
            <span className="text-xs text-text-secondary">
              {t("entity:realm_member_count", {
                count: realm.memberCount ?? 0,
              })}
            </span>
            {realm.isPublic && (
              <span className="text-xs text-text-brand">
                {t("entity:realm_public")}
              </span>
            )}
            {realm.isOfficial && (
              <span className="text-xs text-text-secondary">
                {t("entity:realm_official")}
              </span>
            )}
          </div>
        </div>

        <RealmDetailShell>{children}</RealmDetailShell>
      </div>
    </RealmDetailProvider>
  );
}
