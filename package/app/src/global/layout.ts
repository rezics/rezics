import { proxy } from 'valtio';

interface LayoutState {
  sidebarOpen: boolean;
  openItems: Record<string, boolean>;
}

export const layoutState = proxy<LayoutState>({
  sidebarOpen: true,
  openItems: {},
});

export const layoutActions = {
  toggleSidebar: () => {
    layoutState.sidebarOpen = !layoutState.sidebarOpen;
  },
  closeSidebar: () => {
    layoutState.sidebarOpen = false;
  },
  toggleItem: (segment: string) => {
    layoutState.openItems[segment] = !layoutState.openItems[segment];
  },
}; 