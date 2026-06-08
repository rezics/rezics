import { myRealmsQuery } from "@rezics/api/realm/realm.queries";
import { useTranslation } from "@rezics/i18n/react";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import {
  selectHasAuthIdentity,
  selectHasMemberSession,
  selectShouldRedirectToCompleteRegistration,
  shouldRenderNormalAppChrome,
  useAuthSessionStore,
  useSyncUserProfile,
  useUserProfileStore,
} from "@/user";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";
import { unitHref } from "@/shared/ui/link";
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
  const realmReadQuery = {
    languages: readContext.languages,
    appLocale: readContext.appLocale,
    languageMode: readContext.languageMode,
  } as const;
  const realmsQuery = useQuery({
    ...myRealmsQuery(realmReadQuery),
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
  const realmNavigationItems =
    realmsQuery.data?.realms.map((realm) => ({
      unitId: realm.unitId,
      title: realm.title ?? realm.unitId,
      href: unitHref({
        type: "REALM",
        unitId: realm.unitId,
        slug: realm.slug ?? null,
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
              realms: {
                items: realmNavigationItems,
                isLoading: hasMemberSession && realmsQuery.isLoading,
                errorMessage: realmsQuery.error
                  ? "Failed to load realms"
                  : null,
              },
            },
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
