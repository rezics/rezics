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
    sidebarOpen,
    drawerWidth,
    handleDrawerToggle,
    closeSidebar,
    isSidebarTransitioning,
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
        disableDrawerToggle={isSidebarTransitioning}
      />

      {/* Middle horizontal layout: Sidebar + Page Content */}
      <div className="flex flex-1">
        <Sidebar
          onClose={() => isMobile && closeSidebar()}
          handleDrawerToggle={handleDrawerToggle}
          NAVIGATION={NAVIGATION(isAdmin)}
        />

        <main
          className="flex flex-col flex-1 pt-[56px] sm:pt-[64px] transition-all duration-300"
          style={{
            width: `calc(100% - ${
              !isMobile && sidebarOpen ? drawerWidth : 0
            }px)`,
          }}
        >
          <div className="flex-1 mb-4">{children}</div>
          {/* Footer always at bottom (scrolls naturally when content tall) */}
          <MainLayoutFooter />
        </main>
      </div>
    </div>
  );
};
