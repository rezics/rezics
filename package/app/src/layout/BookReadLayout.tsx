import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import {Button, Divider, useMediaQuery} from '@mui/material';
import React, {type ReactNode, useEffect, useState} from 'react';
// import { Box } from "@mui/material";

import {DraggableResizer} from '@/component/Layout/DraggableResizer';
import {LinearChapterList} from '@/component/Book/Chapter/LinearChapterList';
import {Link, useParams, useRoute} from 'wouter';
import {useResponsiveSidebar} from './useResponsiveSidebar';
export interface BookReadLayoutProps {
  children: ReactNode;
  bookId: string;
  chapterId: string;
}

export const BookReadLayout: React.FC<BookReadLayoutProps> = ({
  children,
  bookId,
  chapterId,
}) => {
  const [match, params] = useRoute('/book/:bookId/read/:chapterId');
  const locationParams = useParams();
  const [selectedId, setSelectedId] = useState(
    match ? String(params.chapterId) : '',
  );

  useEffect(() => {
    setSelectedId(match ? String(params.chapterId) : '');
  }, [match, params]);

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
          noScrollBar={false}
          onOverflowx={true}
          onOverflowy={true}
        >
          <div>
            <div className="flex items-center justify-between mb-2 bg-gray-50 text-sm text-gray-800">
              <div className="font-medium">目录</div>
              <Link
                to={`/book/${locationParams[0]}/`}
                className="text-blue-600 hover:underline"
              >
                <Button variant="text">返回书籍</Button>
              </Link>
            </div>
            <Divider className="mb-4" />
            <LinearChapterList
              readingMode={true}
              bookId={bookId || ''}
              chapterId={chapterId || ''}
              height={1200}
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
