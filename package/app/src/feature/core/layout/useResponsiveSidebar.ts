import {useState} from 'react';
import type React from 'react';
import {useLayoutStore} from '../state/layoutStore.ts';
import {appStore} from '@/global/appStore.ts';
import {useUserStore} from '@/global/userStore';
import {useIsMobile} from '@/shared/util/useMediaQueryUtil';

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
  themeMode: 'light' | 'dark';
  toggleTheme: () => void;
  isAdmin: boolean;
}

export const useResponsiveSidebar = (): ResponsiveSidebarState => {
  const isMobile = useIsMobile();
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen);
  const drawerWidth = useLayoutStore(s => s.drawerWidth);
  const toggleSidebar = useLayoutStore(s => s.toggleSidebar);
  const closeSidebar = useLayoutStore(s => s.closeSidebar);

  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);

  const themeMode = appStore(state => state.theme);
  function toggleTheme() {
    appStore.setState({theme: themeMode === 'light' ? 'dark' : 'light'});
  }

  const isAdmin = useUserStore(state =>
    state.user?.permission?.role?.includes('ADMIN'),
  );

  function setDrawerWidth(width: number) {
    useLayoutStore.setState({drawerWidth: width});
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
