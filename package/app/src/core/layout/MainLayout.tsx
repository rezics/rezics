import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAuthSessionStore, useUserProfileStore } from "@/user/state";
import { MainLayoutFooter } from "../component/footer/MainLayoutFooter";
import { HelpFab } from "../component/HelpWidget";
import { Header } from "../component/header/MainLayoutHeader";
import { NAVIGATION } from "../component/navigation/MainNavigation";
import { Sidebar } from "../component/sidebar/MainLayoutSidebar";
import { shouldShowVerificationBanner } from "./verificationBanner";

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAdmin =
    useUserProfileStore((state) =>
      state.user?.permission?.role?.includes("ADMIN"),
    ) ?? false;
  const showVerificationBanner = useAuthSessionStore((state) =>
    shouldShowVerificationBanner(state.permission, state.needsVerification),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        {/* Middle horizontal layout: Sidebar + Page Content */}
        <Sidebar
          sidebarHeaderClassName="mx-6"
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 min-w-0 pt-[60px] transition-all duration-300 h-screen w-full">
          {showVerificationBanner ? (
            <div className="px-4 pt-4">
              <Alert
                severity="warning"
                action={
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => navigate({ to: "/verify-email" })}
                  >
                    {t("auth.flow.verify_banner_action")}
                  </Button>
                }
              >
                {t("auth.flow.verify_banner_message")}
              </Alert>
            </div>
          ) : null}
          <div className="flex-1 pb-4 dark:bg-dark bg-light">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
      <HelpFab />
    </div>
  );
};
