import { useLocation, useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useSyncUserProfile } from "@/user/hooks/useSyncUserProfile";
import {
  selectShouldRedirectToCompleteRegistration,
  useAuthSessionStore,
  useUserProfileStore,
} from "@/user/states";
import { MainLayoutFooter } from "../components/footer/MainLayoutFooter";
import { HelpFab } from "../components/HelpWidget";
import { Header } from "../components/header/MainLayoutHeader";
import { NAVIGATION } from "../components/navigation/MainNavigation";
import { Sidebar } from "../components/sidebar/MainLayoutSidebar";

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  useSyncUserProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const pendingRegistration = useAuthSessionStore(
    selectShouldRedirectToCompleteRegistration,
  );

  const isAdmin =
    useUserProfileStore((state) =>
      state.user?.permission?.role?.includes("ADMIN"),
    ) ?? false;

  useEffect(() => {
    if (pendingRegistration && location.pathname !== "/complete-registration") {
      navigate({ to: "/complete-registration", replace: true });
    }
  }, [location.pathname, navigate, pendingRegistration]);

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        <Sidebar
          sidebarHeaderClassName="mx-8"
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 min-w-0 pt-[60px] transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
      <HelpFab />
    </div>
  );
};
