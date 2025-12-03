import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import {useMediaQuery} from '@mui/material';
import React from 'react';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {NAVIGATION} from '@/component/Layout/Navigation/MainNavigation';
import {appStore} from '@/global/appStore.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {useUserStore} from '@/global/userStore';

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  const isMobile = useMediaQuery('(max-width:960px)');
  const {sidebarOpen, drawerWidth, toggleSidebar, closeSidebar} =
    useLayoutStore();

  const handleDrawerToggle = () => {
    toggleSidebar();
  };

  const mode = appStore(state => state.theme);
  function toggleTheme() {
    appStore.setState({theme: mode === 'light' ? 'dark' : 'light'});
  }

  const isAdmin = useUserStore(state =>
    state.user?.permission?.role?.includes('ADMIN'),
  );

  return (
    <div className="flex min-h-screen">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={mode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
      />

      <Sidebar
        onClose={() => isMobile && closeSidebar()}
        handleDrawerToggle={handleDrawerToggle}
        NAVIGATION={NAVIGATION(isAdmin)}
      />

      <main
        className="flex-grow pt-[56px] sm:pt-[64px] transition-all duration-300"
        style={{
          width: `calc(100% - ${!isMobile && sidebarOpen ? drawerWidth : 0}px)`,
        }}
      >
        {children}
      </main>
    </div>
  );
};
