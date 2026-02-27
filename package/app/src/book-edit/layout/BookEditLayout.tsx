import {Header} from '@/core/component/header/MainLayoutHeader.tsx';
import {Sidebar} from '@/core/component/sidebar/MainLayoutSidebar.tsx';
import React, {type ReactNode, useEffect, useState} from 'react';

import {NAVIGATION} from './BookEditorNavigation';
import {useLayoutStore} from '@/core/state/layoutStore.ts';

import {LinearChapterList} from '@/book-library/component/Chapter/LinearChapterList';

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

  // UI state
  const {sidebarHeightBelow} = useLayoutStore();

  return (
    <div className="flex min-h-screen">
      <Header />
      <div id="book-edit-sidebar">
        <Sidebar NAVIGATION={NAVIGATION(bookId || '')}>
          <LinearChapterList
            bookId={bookId || ''}
            chapterId={chapterId || ''}
            height={sidebarHeightBelow + 50}
          />
        </Sidebar>
      </div>

      <main className="flex-grow pt-16 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
