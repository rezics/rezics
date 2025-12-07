import {useMediaQuery} from '@mui/material';
import {useEffect, useState} from 'react';
import type React from 'react';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {appStore} from '@/global/appStore.ts';
import {useUserStore} from '@/global/userStore';

// TODO Introduce Layout Store instead of useState for drawer width and sidebar open state

export interface ResponsiveSidebarState {
  isMobile: boolean;
  sidebarOpen: boolean;
  drawerWidth: number;
  isDragging: boolean;
  handleDrawerToggle: () => void;
  setSidebarOpen: (open: boolean) => void;
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
  const isMobile = useMediaQuery('(max-width:960px)');
  const sidebarOpen = useLayoutStore(state => state.sidebarOpen);
  const drawerWidth = useLayoutStore(state => state.drawerWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);

  const themeMode = appStore(state => state.theme);
  function toggleTheme() {
    appStore.setState({theme: themeMode === 'light' ? 'dark' : 'light'});
  }

  const isAdmin = useUserStore(state =>
    state.user?.permission?.role?.includes('ADMIN'),
  );

  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  function setDrawerWidth(width: number) {
    useLayoutStore.setState({drawerWidth: width});
  }
  function setSidebarOpen(open: boolean = true) {
    useLayoutStore.setState({sidebarOpen: open});
  }
  function closeSidebar() {
    useLayoutStore.setState({sidebarOpen: false});
  }
  const handleDrawerToggle = () => {
    setIsSidebarTransitioning(true);
    setSidebarOpen(!sidebarOpen);
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
    setSidebarOpen,
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
