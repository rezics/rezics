// src/stores/useLayoutStore.ts
import { create } from "zustand";

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

export const useLayoutStore = create<LayoutState>((set: any) => ({
	// 初始 state
	sidebarOpen: true,
	sidebarHeightBelow: 0,
	drawerWidth: 240,
	openItems: {},

	// actions
	toggleSidebar: () =>
		set((state: any) => ({ sidebarOpen: !state.sidebarOpen })),

	closeSidebar: () => set({ sidebarOpen: false }),

	setSidebarHeightBelow: (h: number) => set({ sidebarHeightBelow: h }),

	toggleItem: (segment: string) =>
		set((state: any) => ({
			openItems: {
				...state.openItems,
				[segment]: !state.openItems[segment],
			},
		})),
}));
