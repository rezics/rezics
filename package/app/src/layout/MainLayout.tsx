import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import {useMediaQuery} from '@mui/material';
import React, {useState} from 'react';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {NAVIGATION} from '@/component/Layout/Navigation/MainNavigation';
import {appStore} from '@/global/appStore.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';
import {useUserStore} from '@/global/userStore';
import {MainLayoutFooter} from '@/component/Layout/Footer/MainLayoutFooter.tsx';

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  const isMobile = useMediaQuery('(max-width:960px)');
  const {sidebarOpen, drawerWidth, toggleSidebar, closeSidebar} =
    useLayoutStore();
  const [isSidebarTransitioning, setIsSidebarTransitioning] = useState(false);
  const handleDrawerToggle = () => {
    setIsSidebarTransitioning(true);
    toggleSidebar();
    window.setTimeout(() => {
      setIsSidebarTransitioning(false);
    }, 300);
  };

  const mode = appStore(state => state.theme);
  function toggleTheme() {
    appStore.setState({theme: mode === 'light' ? 'dark' : 'light'});
  }

  const isAdmin = useUserStore(state =>
    state.user?.permission?.role?.includes('ADMIN'),
  );

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      {/* Header stays at the top */}
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={mode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
        layoutType="type-b"
        disableDrawerToggle={isSidebarTransitioning}
      />

      {/* Middle horizontal layout: Sidebar + Page Content */}
      <div className="flex flex-1">
        <Sidebar
          layoutType="type-b"
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
