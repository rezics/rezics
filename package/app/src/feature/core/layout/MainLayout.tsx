import {Header} from '../component/Header/MainLayoutHeader';
import {Sidebar} from '../component/Sidebar/Sidebar';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {NAVIGATION} from '../component/Navigation/MainNavigation';
import {MainLayoutFooter} from '../component/Footer/MainLayoutFooter.tsx';
import React from 'react';
import {useLayoutStore} from '../state/layoutStore.ts';
import {appStore} from '@/global/appStore.ts';
import {useUserStore} from '@/global/userStore';
import {useIsMobile} from '@/shared/util/useMediaQueryUtil';

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  const isMobile = useIsMobile();
  const sidebarOpen = useLayoutStore(s => s.sidebarOpen);
  const drawerWidth = useLayoutStore(s => s.drawerWidth);
  const toggleSidebar = useLayoutStore(s => s.toggleSidebar);
  const closeSidebar = useLayoutStore(s => s.closeSidebar);

  const themeMode = appStore(state => state.theme);
  const toggleTheme = () => {
    appStore.setState({theme: themeMode === 'light' ? 'dark' : 'light'});
  };

  const isAdmin =
    useUserStore(state => state.user?.permission?.role?.includes('ADMIN')) ??
    false;

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>
      <Header
        handleDrawerToggle={toggleSidebar}
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
          handleDrawerToggle={toggleSidebar}
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 pt-[56px] sm:pt-[64px] transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4 dark:bg-dark bg-light">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
    </div>
  );
};
