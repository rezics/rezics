// src/stores/useLayoutStore.ts
import {create} from 'zustand';
import {devtools} from 'zustand/middleware';

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
      sidebarOpen: true,
      sidebarHeightBelow: 0,
      drawerWidth: 240,
      openItems: {},

      // actions
      toggleSidebar: () =>
        set((state: any) => ({
          sidebarOpen: !state.sidebarOpen,
          drawerWidth: state.drawerWidth === 240 ? 0 : 240,
        })),

      closeSidebar: () => set({sidebarOpen: false, drawerWidth: 0}),

      setSidebarHeightBelow: (h: number) => set({sidebarHeightBelow: h}),

      toggleItem: (segment: string) =>
        set((state: any) => ({
          openItems: {
            ...state.openItems,
            [segment]: !state.openItems[segment],
          },
        })),
    }),
    {name: 'layoutStore'},
  ),
);
