import type React from "react";
import { useState } from "react";
import { useAppStore } from "@/app/states/appStore.ts";
import { useIsMobile } from "@/shared/utils/use-media-query";
import { useUserProfileStore } from "@/user/states";
import { useLayoutStore } from "../states/layoutStore.ts";

// TODO Introduce Layout Store instead of useState for drawer width and sidebar open state

export interface ResponsiveSidebarState {
  isMobile: boolean;
  sidebarOpen: boolean;
  drawerWidth: number;
  isDragging: boolean;
  handleDrawerToggle: () => void;
  closeSidebar: () => void;
  setDrawerWidth: (width: number) => void;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarTransitioning: boolean;
  setIsSidebarTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
  themeMode: "light" | "dark";
  toggleTheme: () => void;
  isAdmin: boolean;
}

export const useResponsiveSidebar = (): ResponsiveSidebarState => {
  const isMobile = useIsMobile();
  const sidebarOpen = useLayoutStore((s) => s.sidebarOpen);
  const drawerWidth = useLayoutStore((s) => s.drawerWidth);
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar);
  const closeSidebar = useLayoutStore((s) => s.closeSidebar);

  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);

  const themeMode = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  function toggleTheme() {
    setTheme(themeMode === "light" ? "dark" : "light");
  }

  const isAdmin = useUserProfileStore((state) =>
    state.user?.permission?.role?.includes("ADMIN"),
  );

  function setDrawerWidth(width: number) {
    useLayoutStore.setState({ drawerWidth: width });
  }
  const handleDrawerToggle = () => {
    setIsSidebarTransitioning(true);
    toggleSidebar();
    window.setTimeout(() => {
      setIsSidebarTransitioning(false);
    }, 300);
  };

  return {
    isMobile,
    sidebarOpen,
    drawerWidth,
    isDragging,
    handleDrawerToggle,
    closeSidebar,
    setDrawerWidth,
    setIsDragging,
    isSidebarTransitioning,
    setIsSidebarTransitioning,
    themeMode,
    toggleTheme,
    isAdmin: isAdmin ?? false,
  };
};
