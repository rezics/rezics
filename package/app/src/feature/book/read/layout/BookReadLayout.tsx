import {Header} from '../component/Header/MainLayoutHeader';
import {Sidebar} from '../component/Sidebar/Sidebar';
import {Button, Divider, useMediaQuery} from '@mui/material';
import React, {type ReactNode, useEffect, useState} from 'react';

import {DraggableResizer} from '../component/DraggableResizer';
import {LinearChapterList} from '@feature/book/library/ui/component/Chapter/LinearChapterList';
import {useNavigate} from '@tanstack/react-router';
import {useResponsiveSidebar} from './useResponsiveSidebar';
import {useLayoutStore} from '../state/layoutStore.ts';
import {bookReadLayoutRoute} from '@/router';
export interface BookReadLayoutProps {
  children: ReactNode;
}

export const BookReadLayout: React.FC<BookReadLayoutProps> = ({children}) => {
  const navigate = useNavigate();
  const {bookId, chapterId} = bookReadLayoutRoute.useParams();
  const [selectedId, setSelectedId] = useState(String(chapterId ?? ''));

  const {sidebarHeightBelow} = useLayoutStore();

  useEffect(() => {
    setSelectedId(String(chapterId ?? ''));
  }, [chapterId]);

  const {
    sidebarOpen,
    handleDrawerToggle,
    themeMode,
    toggleTheme,
    drawerWidth,
    isMobile,
    closeSidebar,
    setDrawerWidth,
    setIsDragging,
    isSidebarTransitioning,
  } = useResponsiveSidebar();

  return (
    <div className="flex min-h-screen">
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={themeMode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
        disableDrawerToggle={isSidebarTransitioning}
      />

      <div id="book-read-sidebar">
        <Sidebar
          sidebarOpen={sidebarOpen}
          sidebarWidth={drawerWidth}
          isMobile={isMobile}
          onClose={() => isMobile && closeSidebar()}
          handleDrawerToggle={handleDrawerToggle}
          NAVIGATION={[]}
          sidebarClassName="overflow-x-hidden overflow-y-hidden"
        >
          <div>
            <div className="flex items-center justify-between mb-2 bg-gray-50 text-sm text-gray-800">
              <div className="font-medium">目录</div>
              <Button
                variant="text"
                onClick={() => {
                  navigate({to: `/book/${bookId}/`});
                }}
              >
                返回书籍
              </Button>
            </div>
            <Divider className="mb-4" />
            <LinearChapterList
              readingMode={true}
              bookId={bookId || ''}
              chapterId={chapterId || ''}
              height={sidebarHeightBelow}
            />
          </div>
        </Sidebar>

        <DraggableResizer
          targetId="book-read-sidebar"
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
