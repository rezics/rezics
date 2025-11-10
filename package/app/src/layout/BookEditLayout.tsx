import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import {useMediaQuery} from '@mui/material';
import React, {type ReactNode, useEffect, useState} from 'react';

import {NAVIGATION} from '@/component/Layout/Navigation/BookEditorNavigation';
import {appStore} from '@/global/appStore.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';

import {LinearChapterList} from '@/component/Book/Chapter/LinearChapterList';

import {DraggableResizer} from '@/component/Layout/DraggableResizer.tsx';

interface BookEditLayoutProps {
  bookId?: string;
  chapterId?: string;
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({
  children,
  bookId,
  chapterId,
}) => {
  const isMobile = useMediaQuery('(max-width:960px)');
  const {sidebarOpen, drawerWidth, toggleSidebar, closeSidebar} =
    useLayoutStore();

  const handleDrawerToggle = () => {
    toggleSidebar();
  };

  const mode = appStore((state: any) => state.theme);
  function toggleTheme() {
    appStore.setState({theme: mode === 'light' ? 'dark' : 'light'});
  }

  function setDrawerWidth(width: number) {
    useLayoutStore.setState({drawerWidth: width});
  }

  const [isDragging, setIsDragging] = useState(false);

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
        mode={mode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
        isDragging={isDragging}
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
