import {Header} from '@/core/component/Header/MainLayoutHeader.tsx';
import {Sidebar} from '@/core/component/Sidebar/MainLayoutSidebar.tsx';
import React, {type ReactNode, useEffect, useState} from 'react';

import {NAVIGATION} from './BookEditorNavigation';
import {useLayoutStore} from '@/core/state/layoutStore.ts';

import {LinearChapterList} from '@/book/library/component/Chapter/LinearChapterList';

import {DraggableResizer} from '@/core/component/DraggableResizer.tsx';
import {bookEditChapterRoute, bookEditLayoutRoute} from '@/router';

export interface BookEditLayoutProps {
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({children}) => {
  const bookId: string | undefined = bookEditLayoutRoute.useParams().bookId;
  let chapterId: string | undefined;
  try {
    chapterId = bookEditChapterRoute.useParams().chapterId;
  } catch (error) {
    chapterId = undefined;
  }
  const {
    sidebarOpen,
    handleDrawerToggle,
    themeMode,
    toggleTheme,
    drawerWidth,
    setDrawerWidth,
    isMobile,
    closeSidebar,
    isDragging,
    setIsDragging,
    isSidebarTransitioning,
  } = useResponsiveSidebar();

  // UI state
  const {sidebarHeightBelow} = useLayoutStore();

  return (
    <div className="flex min-h-screen">
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={themeMode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
        isDragging={isDragging}
        disableDrawerToggle={isSidebarTransitioning}
      />
      <div id="book-edit-sidebar">
        <Sidebar
          sidebarOpen={sidebarOpen}
          sidebarWidth={drawerWidth}
          isMobile={isMobile}
          onClose={() => isMobile && closeSidebar()}
          handleDrawerToggle={handleDrawerToggle}
          NAVIGATION={NAVIGATION(bookId || '')}
          isDragging={isDragging}
        >
          <LinearChapterList
            bookId={bookId || ''}
            chapterId={chapterId || ''}
            width={drawerWidth}
            height={sidebarHeightBelow + 50}
          />
        </Sidebar>
        <DraggableResizer
          targetId="book-edit-sidebar"
          setSidebarWidth={setDrawerWidth}
          onDragging={setIsDragging}
        />
      </div>

      <main
        className="flex-grow pt-16 transition-all duration-300"
        style={{
          width: `calc(100% - ${!isMobile && sidebarOpen ? drawerWidth : 0}px)`,
        }}
      >
        {children}
      </main>
    </div>
  );
};
