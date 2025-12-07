import {useMediaQuery} from '@mui/material';
import {useEffect, useState} from 'react';
import type React from 'react';

// TODO Introduce Layout Store instead of useState for drawer width and sidebar open state

export interface ResponsiveSidebarState {
  isMobile: boolean;
  sidebarOpen: boolean;
  drawerWidth: number;
  isDragging: boolean;
  handleDrawerToggle: () => void;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDrawerWidth: React.Dispatch<React.SetStateAction<number>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  isSidebarTransitioning: boolean;
  setIsSidebarTransitioning: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useResponsiveSidebar = (
  initialWidth = 300,
): ResponsiveSidebarState => {
  const isMobile = useMediaQuery('(max-width:960px)');
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [drawerWidth, setDrawerWidth] = useState(initialWidth);
  const [isDragging, setIsDragging] = useState(false);
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);
  useEffect(() => {
    setSidebarOpen(!isMobile);
  }, [isMobile]);

  const handleDrawerToggle = () => {
    setSidebarOpen(prev => !prev);
  };

  return {
    isMobile,
    sidebarOpen,
    drawerWidth,
    isDragging,
    handleDrawerToggle,
    setSidebarOpen,
    setDrawerWidth,
    setIsDragging,
    isSidebarTransitioning,
    setIsSidebarTransitioning,
  };
};
