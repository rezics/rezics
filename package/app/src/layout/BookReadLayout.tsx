import {Header} from '@/component/Layout/Header/MainLayoutHeader';
import {Sidebar} from '@/component/Layout/Sidebar/Sidebar';
import {Button, Divider, useMediaQuery} from '@mui/material';
import React, {ReactNode, useEffect, useState} from 'react';
// import { Box } from "@mui/material";
import {appStore} from '@/global/appStore.ts';
import {useLayoutStore} from '@/global/Layout/layoutStore.ts';

import {DraggableResizer} from '@/component/Layout/DraggableResizer.tsx';
import {ChapterListEditor} from '@/component/Book/Chapter/ChapterListEditor';
import {Link, useParams, useRoute} from 'wouter';
interface BookReadLayoutProps {
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
  const isMobile = useMediaQuery('(max-width:960px)');
  const {sidebarOpen, drawerWidth, toggleSidebar, closeSidebar} =
    useLayoutStore();
  const [baseUrl, setBaseUrl] = useState('');
  const [selectedId, setSelectedId] = useState(
    match ? String(params.chapterId) : '',
  );

  useEffect(() => {
    console.log('match, params', match, params);
    setSelectedId(match ? String(params.chapterId) : '');
  }, [match, params]);

  const handleDrawerToggle = () => {
    toggleSidebar();
  };

  function setDrawerWidth(width: number) {
    useLayoutStore.setState({drawerWidth: width});
  }

  const [isDragging, setIsDragging] = useState(false);

  const mode = appStore((state: any) => state.theme);
  function toggleTheme() {
    appStore.setState({theme: mode === 'light' ? 'dark' : 'light'});
  }

  return (
    <div className="flex min-h-screen">
      <Header
        handleDrawerToggle={handleDrawerToggle}
        mode={mode}
        onThemeToggle={toggleTheme}
        drawerWidth={drawerWidth}
      />

      <Sidebar
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
              <Button variant="text">查看详情</Button>
            </Link>
          </div>
          <Divider />
          <ChapterListEditor
            bookId={bookId || ''}
            chapterId={chapterId || ''}
            drawerWidth={drawerWidth}
            isDraggable={true}
            enableDoubleClickRename={false}
          />
        </div>
      </Sidebar>

      <DraggableResizer
        targetId="book-edit-sidebar"
        setSidebarWidth={setDrawerWidth}
        onDragging={setIsDragging}
      />

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
