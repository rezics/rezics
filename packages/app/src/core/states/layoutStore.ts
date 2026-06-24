import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface LayoutState {
  sidebarOpen: boolean;
  sidebarHeightBelow: number;
  openItems: Record<string, boolean>;
  drawerWidth: number;
  // actions — 操作
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarHeightBelow: (h: number) => void;
  toggleItem: (segment: string, defaultOpen?: boolean) => void;
}

/**
 * TODO: switch to unified media-query settings. TODO 换到统一媒体查询设置。
 * @returns
 */
function getInitialSidebarOpen() {
  if (typeof window === "undefined") return true; // Stay stable during SSR — SSR 期间保持稳定
  return !window.matchMedia("(max-width: 960px)").matches;
}

export const useLayoutStore = create<LayoutState>()(
  devtools(
    (set: any) => ({
      // Initial state — 初始 state
      sidebarOpen: getInitialSidebarOpen(),
      sidebarHeightBelow: 0,
      drawerWidth: 280,
      openItems: {},

      // actions — 操作
      toggleSidebar: () =>
        set((state: any) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

      closeSidebar: () => set({ sidebarOpen: false }),

      setSidebarHeightBelow: (h: number) => set({ sidebarHeightBelow: h }),

      toggleItem: (segment: string, defaultOpen = false) =>
        set((state: any) => ({
          openItems: {
            ...state.openItems,
            [segment]: !(state.openItems[segment] ?? defaultOpen),
          },
        })),
    }),
    { name: "layoutStore", store: "layoutStore" },
  ),
);
