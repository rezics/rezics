import { useLocation, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSyncUserProfile } from "@/user/hooks/useSyncUserProfile";
import { shouldRenderNormalAppChrome } from "@/user/models/authRedirect";
import {
  selectHasAuthIdentity,
  selectHasMemberSession,
  selectShouldRedirectToCompleteRegistration,
  useAuthSessionStore,
  useUserProfileStore,
} from "@/user/states";
import { MainLayoutFooter } from "../components/footer/MainLayoutFooter";
import { HelpFab } from "../components/HelpWidget";
import { Header } from "../components/header/MainLayoutHeader";
import { NAVIGATION } from "../components/navigation/MainNavigation";
import { Sidebar } from "../components/sidebar/MainLayoutSidebar";
import { useMessage } from "@rezics/i18n/react";
import {
  app_document_title_account_settings,
  app_document_title_library,
} from "@rezics/i18n/messages";
const m = {
  app_document_title_account_settings,
  app_document_title_library,
};

const i18nMessages = {
  app_document_title_account_settings,
  app_document_title_library,
};

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const m = useMessage(i18nMessages);
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
  const canRenderChrome = shouldRenderNormalAppChrome({
    hasAuthIdentity,
    hasMemberSession,
    registrationComplete,
  });

  const isAdmin =
    useUserProfileStore((state) =>
      state.user?.permission?.role?.includes("ADMIN"),
    ) ?? false;

  useEffect(() => {
    if (pendingRegistration && location.pathname !== "/complete-registration") {
      navigate({ to: "/complete-registration", replace: true });
    }
  }, [location.pathname, navigate, pendingRegistration]);

  if (!canRenderChrome) {
    return (
      <div className="min-h-screen bg-surface-canvas">
        <Helmet>
          <title>{m.app_document_title_account_settings()}</title>
        </Helmet>
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>{m.app_document_title_library()}</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        <Sidebar
          sidebarHeaderClassName="mx-8"
          NAVIGATION={NAVIGATION(isAdmin)}
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
