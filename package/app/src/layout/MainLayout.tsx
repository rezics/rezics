import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {NAVIGATION} from '@/component/Layout/Navigation/MainNavigation';
import {MainLayoutFooter} from '@/component/Layout/Footer/MainLayoutFooter.tsx';
import {useResponsiveSidebar} from './useResponsiveSidebar';
import React from 'react';

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  const {
    isMobile,
    drawerWidth,
    sidebarOpen,
    handleDrawerToggle,
    closeSidebar,
    themeMode,
    toggleTheme,
    isAdmin,
  } = useResponsiveSidebar();

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      {/* Header stays at the top */}
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={themeMode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
      />

      <div className="flex flex-1">
        {/* Middle horizontal layout: Sidebar + Page Content */}
        <Sidebar
          sidebarOpen={sidebarOpen}
          sidebarWidth={drawerWidth}
          sidebarHeaderClassName="mx-6"
          isMobile={isMobile}
          onClose={() => isMobile && closeSidebar()}
          handleDrawerToggle={handleDrawerToggle}
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 pt-[56px] sm:pt-[64px] transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4 dark:bg-dark bg-light">{children}</div>
          {/* Footer always at bottom (scrolls naturally when content tall) */}
          <MainLayoutFooter />
        </main>
      </div>
    </div>
  );
};
