// src/stores/useLayoutStore.ts
import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * TODO 换到统一媒体查询设置
 * @returns
 */
function getInitialSidebarOpen() {
  if (typeof window === "undefined") return true; // SSR 期间保持稳定
  return !window.matchMedia("(max-width: 960px)").matches;
}

interface LayoutState {
  sidebarOpen: boolean;
  sidebarHeightBelow: number;
  openItems: Record<string, boolean>;
  drawerWidth: number;
  // actions
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarHeightBelow: (h: number) => void;
  toggleItem: (segment: string) => void;
}

export const useLayoutStore = create<LayoutState>()(
  devtools(
    (set: any) => ({
      // 初始 state
      sidebarOpen: getInitialSidebarOpen(),
      sidebarHeightBelow: 0,
      drawerWidth: 280,
      openItems: {},

      // actions
      toggleSidebar: () =>
        set((state: any) => ({
          sidebarOpen: !state.sidebarOpen,
        })),

      closeSidebar: () => set({ sidebarOpen: false }),

      setSidebarHeightBelow: (h: number) => set({ sidebarHeightBelow: h }),

      toggleItem: (segment: string) =>
        set((state: any) => ({
          openItems: {
            ...state.openItems,
            [segment]: !state.openItems[segment],
          },
        })),
    }),
    { name: "layoutStore", store: "layoutStore" },
  ),
);
