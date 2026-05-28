import { useTranslation } from "@rezics/i18n/react";
import { useRouterState } from "@tanstack/react-router";
import React from "react";
import { AuthenticatedSection } from "@/core/sections/header/AuthenticatedSection.tsx";
import { PendingVerificationSection } from "@/core/sections/header/PendingVerificationSection.tsx";
import { UnauthenticatedSection } from "@/core/sections/header/UnauthenticatedSection.tsx";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { useAuth } from "@/user/pages/useAuth";
import { useLayoutStore } from "../../states/layoutStore.ts";
import { DrawerToggler } from "./DrawerToggler.tsx";
import { HeaderSearch } from "./HeaderSearch.tsx";

interface HeaderProps {
  isDragging?: boolean;
  layoutType?: "type-a" | "type-b";
  disableDrawerToggle?: boolean;
}

export const Header: React.FC<HeaderProps> = React.memo(
  ({
    isDragging = false,
    layoutType = "type-b",
    disableDrawerToggle = false,
  }) => {
    const { t } = useTranslation(["common"]);
const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
    const drawerWidth = useLayoutStore((s) => s.drawerWidth);
    const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);

    const isHomePage = useRouterState({
      select: (s) => s.location.pathname === "/",
    });

    const handleDrawerToggle = () => {
      if (!disableDrawerToggle) toggleSidebar();
    };

    const auth = useAuth();

    const authSection = (() => {
      if (auth.readyForApp && auth.user) return <AuthenticatedSection />;
      if (auth.hasAuthIdentity && !auth.registrationComplete)
        return <PendingVerificationSection />;
      return <UnauthenticatedSection />;
    })();

    const isOffsetByDrawer = layoutType === "type-a" && sidebarOpen;

    return (
      <header
        className={cn(
          "fixed top-0 z-40 bg-surface-canvas border-b border-border-whisper transition-[margin,width] duration-225 ease-out pointer-events-auto",
          isDragging && "rounded-tl-2xl rounded-bl-2xl",
        )}
        style={{
          marginLeft: isOffsetByDrawer ? `${drawerWidth}px` : 0,
          width: isOffsetByDrawer ? `calc(100% - ${drawerWidth}px)` : "100%",
        }}
      >
        <div className="flex h-[49px] items-center gap-1 px-2 md:h-14 md:gap-2 md:px-6">
          <DrawerToggler
            handleDrawerToggleInner={handleDrawerToggle}
            layoutType={layoutType}
            sidebarOpen={sidebarOpen}
          />

          <Link to="/" className="flex items-center gap-2 shrink-0">
            {!isHomePage && (
              <div className="w-10 h-10 inline-flex items-center justify-center rounded-md bg-transparent overflow-hidden">
                <img src="/logo.svg" alt={t("common:logo_alt")} />
              </div>
            )}
            <h1 className="text-3xl font-bold text-brand-fill m-0">REZICS</h1>
          </Link>

          <div className="flex flex-1 min-w-0 justify-end md:justify-center md:px-4">
            <HeaderSearch />
          </div>

          {authSection}
        </div>
      </header>
    );
  },
);
