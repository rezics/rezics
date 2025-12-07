import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import React, {type ReactNode, useEffect, useState} from 'react';

import {NAVIGATION} from '@/component/Layout/Navigation/BookEditorNavigation';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';

import {LinearChapterList} from '@/component/Book/Chapter/LinearChapterList';

import {DraggableResizer} from '@/component/Layout/DraggableResizer.tsx';
import {useResponsiveSidebar} from './useResponsiveSidebar';

export interface BookEditLayoutProps {
  bookId?: string;
  chapterId?: string;
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({
  children,
  bookId,
  chapterId,
}) => {
  const {
    sidebarOpen,
    handleDrawerToggle,
    themeMode,
    toggleTheme,
    drawerWidth,
    isMobile,
    closeSidebar,
    setDrawerWidth,
    isDragging,
    setIsDragging,
    isSidebarTransitioning,
  } = useResponsiveSidebar();

  // UI state
  const {sidebarHeightBelow} = useLayoutStore();
  const [height, setHeight] = useState(sidebarHeightBelow);

  useEffect(() => {
    setHeight(sidebarHeightBelow);
  }, [sidebarHeightBelow]);

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
          onClose={() => isMobile && closeSidebar()}
          handleDrawerToggle={handleDrawerToggle}
          NAVIGATION={NAVIGATION(bookId || '')}
          noScrollBar={true}
          isDragging={isDragging}
        >
          <LinearChapterList
            bookId={bookId || ''}
            chapterId={chapterId || ''}
            width={drawerWidth}
            height={height}
            isDraggable={true}
            enableDoubleClickRename={false}
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
