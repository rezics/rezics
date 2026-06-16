import { mySubscriptionListEntriesQuery } from "@rezics/api/subscription/subscription";
import type { UserSubscriptionListEntryDTO } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { unitHref } from "@/shared/ui/link";
import {
  selectHasAuthIdentity,
  selectHasMemberSession,
  selectShouldRedirectToCompleteRegistration,
  shouldRenderNormalAppChrome,
  useAuthSessionStore,
  useSyncUserProfile,
  useUserProfileStore,
} from "@/user";
import { MainLayoutFooter } from "../components/footer/MainLayoutFooter";
import { HelpFab } from "../components/HelpWidget";
import { Header } from "../components/header/MainLayoutHeader";
import { NAVIGATION } from "../components/navigation/MainNavigation";
import { Sidebar } from "../components/sidebar/MainLayoutSidebar";

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useTranslation(["shell"]);
  useSyncUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingRegistration = useAuthSessionStore(
    selectShouldRedirectToCompleteRegistration,
  );
  const hasAuthIdentity = useAuthSessionStore(selectHasAuthIdentity);
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const registrationComplete = useAuthSessionStore(
    (state) => state.registration.complete,
  );
  const readContext = useReadLanguageContext();
  const zonesQuery = useQuery({
    ...mySubscriptionListEntriesQuery({ subscribedType: "ZONE" }),
    enabled: hasMemberSession && readContext.ready,
  });
  const realmsQuery = useQuery({
    ...mySubscriptionListEntriesQuery({ subscribedType: "REALM" }),
    enabled: hasMemberSession && readContext.ready,
  });
  const canRenderChrome = shouldRenderNormalAppChrome({
    hasAuthIdentity,
    hasMemberSession,
    registrationComplete,
  });

  const isAdmin =
    useUserProfileStore((state) =>
      state.user?.permission?.role?.includes("ADMIN"),
    ) ?? false;
  const entryNavigationItems = (
    entries: UserSubscriptionListEntryDTO[] | undefined,
  ) =>
    entries?.map((entry) => ({
      unitId: entry.subscribedUnitId,
      title: entry.subscribedTitle ?? entry.subscribedUnitId,
      subscribedType:
        entry.subscribedType === "ZONE" || entry.subscribedType === "REALM"
          ? entry.subscribedType
          : undefined,
      pinned: entry.pinned,
      position: entry.position,
      state: entry.state,
      createdAt:
        entry.createdAt instanceof Date
          ? entry.createdAt.toISOString()
          : entry.createdAt,
      href: unitHref({
        type: entry.subscribedType as any,
        unitId: entry.subscribedUnitId,
        slug: entry.subscribedSlug ?? null,
      }),
    })) ?? [];

  useEffect(() => {
    if (pendingRegistration && location.pathname !== "/complete-registration") {
      navigate({ to: "/complete-registration", replace: true });
    }
  }, [location.pathname, navigate, pendingRegistration]);

  if (!canRenderChrome) {
    return (
      <div className="min-h-screen bg-surface-canvas">
        <Helmet>
          <title>{t("shell:app_document_title_account_settings")}</title>
        </Helmet>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{t("shell:app_document_title_library")}</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        <Sidebar
          sidebarHeaderClassName="mx-8"
          NAVIGATION={NAVIGATION(
            {
              isAuthenticated: hasMemberSession,
              isAdmin,
            },
            {
              zones: {
                items: entryNavigationItems(zonesQuery.data?.entries),
                isLoading: hasMemberSession && zonesQuery.isLoading,
                errorMessage: zonesQuery.error ? "Failed to load zones" : null,
              },
              realms: {
                items: entryNavigationItems(realmsQuery.data?.entries),
                isLoading: hasMemberSession && realmsQuery.isLoading,
                errorMessage: realmsQuery.error
                  ? "Failed to load realms"
                  : null,
              },
            },
            t,
          )}
        />
        <main className="flex flex-col flex-1 min-w-0 pt-[49px] md:pt-14 transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
      <HelpFab />
    </div>
  );
};
