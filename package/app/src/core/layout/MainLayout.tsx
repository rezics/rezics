import {Header} from '../component/header/MainLayoutHeader';
import {Sidebar} from '../component/sidebar/MainLayoutSidebar';
import type {ReactNode} from 'react';
import {Helmet} from 'react-helmet-async';
import {NAVIGATION} from '../component/navigation/MainNavigation';
import {MainLayoutFooter} from '../component/footer/MainLayoutFooter';
import React from 'react';
import {useUserStore} from '@/user/state';
import {HelpFab} from '../component/HelpWidget';

export interface MainLayoutProps {
  children: ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({children}) => {
  const isAdmin =
    useUserStore(state => state.user?.permission?.role?.includes('ADMIN')) ??
    false;

  return (
    <div className="min-h-screen flex flex-col">
      <Helmet>
        <title>REZICS | 书库</title>
      </Helmet>

      <Header />

      <div className="flex flex-1">
        {/* Middle horizontal layout: Sidebar + Page Content */}
        <Sidebar
          sidebarHeaderClassName="mx-6"
          NAVIGATION={NAVIGATION(isAdmin)}
        />
        <main className="flex flex-col flex-1 min-w-0 pt-[60px] transition-all duration-300 h-screen w-full">
          <div className="flex-1 pb-4 dark:bg-dark bg-light">{children}</div>
          <MainLayoutFooter />
        </main>
      </div>
      <HelpFab />
    </div>
  );
};
