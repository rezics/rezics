import { AppBar, Avatar, Toolbar, Typography } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import { useRouterState } from "@tanstack/react-router";
import React from "react";
import { AuthenticatedSection } from "@/core/sections/header/AuthenticatedSection.tsx";
import { PendingVerificationSection } from "@/core/sections/header/PendingVerificationSection.tsx";
import { UnauthenticatedSection } from "@/core/sections/header/UnauthenticatedSection.tsx";
import { HomeSearch } from "@/search";
import { cn } from "@/shared/utils/css-util";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { useAuth } from "@/user/pages/useAuth";
import { useLayoutStore } from "../../states/layoutStore.ts";
import { DrawerToggler } from "./DrawerToggler.tsx";

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
    const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
    const drawerWidth = useLayoutStore((s) => s.drawerWidth);
    const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
    const theme = useTheme();
    const isMobile = useIsMobile();

    const isHomePage = useRouterState({
      select: (s) => s.location.pathname === "/",
    });

    const handleDrawerToggle = () => {
      if (!disableDrawerToggle) toggleSidebar();
    };

    const auth = useAuth();

    const authSection = (() => {
      if (auth.readyForApp && auth.user) return <AuthenticatedSection />;
      if (auth.authenticated && !auth.registrationComplete)
        return <PendingVerificationSection />;
      return <UnauthenticatedSection />;
    })();

    return (
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: theme.zIndex.drawer + 1,
          ml: layoutType === "type-a" && sidebarOpen ? drawerWidth : 0,
          width:
            layoutType === "type-a" && sidebarOpen
              ? `calc(100% - ${drawerWidth}px)`
              : "100%",
          transition: theme.transitions.create(["margin", "width"], {
            easing: theme.transitions.easing.easeOut,
            duration: theme.transitions.duration.enteringScreen,
          }),
          borderBottom: 1,
          borderColor: "divider",
        }}
        className={cn(
          isDragging && "rounded-tl-2xl rounded-bl-2xl",
          "pointer-events-auto",
        )}
      >
        <Toolbar className="px-2 gap-2">
          <DrawerToggler
            handleDrawerToggleInner={handleDrawerToggle}
            layoutType={layoutType}
            sidebarOpen={sidebarOpen}
          />

          <Link to="/" className="flex items-center gap-2 shrink-0">
            {!isHomePage && (
              <Avatar sx={{ bgcolor: "transparent" }} variant="rounded">
                <img src="/logo.svg" alt="logo" />
              </Avatar>
            )}
            <Typography
              variant="h1"
              className="text-3xl font-bold"
              sx={{ color: "primary.main" }}
            >
              REZICS
            </Typography>
          </Link>

          <div className="flex-1 min-w-0 flex justify-center">
            {!isMobile && isHomePage && (
              <HomeSearch className="w-full max-w-md" />
            )}
          </div>

          {authSection}
        </Toolbar>
      </AppBar>
    );
  },
);
