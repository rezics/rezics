import type React from "react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useSyncUserProfile } from "@/user/hooks/useSyncUserProfile";
import { useUserProfileStore } from "@/user/state";
import { MainLayoutFooter } from "../component/footer/MainLayoutFooter";
import { HelpFab } from "../component/HelpWidget";
import { Header } from "../component/header/MainLayoutHeader";
import { NAVIGATION } from "../component/navigation/MainNavigation";
import { Sidebar } from "../component/sidebar/MainLayoutSidebar";

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  useSyncUserProfile();

  const isAdmin =
    useUserProfileStore((state) =>
      state.user?.permission?.role?.includes("ADMIN"),
    ) ?? false;

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        <Sidebar
          sidebarHeaderClassName="mx-6"
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 min-w-0 pt-[60px] transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4 dark:bg-dark bg-light">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
      <HelpFab />
    </div>
  );
};
