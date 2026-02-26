import {Box, Grid} from '@mui/material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import React from 'react';
import {useTranslation} from 'react-i18next';
import {useNavigate, useParams, useRouterState} from '@tanstack/react-router';

import type {BookDTO} from '@package/contract';

import {BookDetailSidebar} from '../component/BookDetail/BookDetailSidebar';

const TAB_ROUTES = ['info', 'review', 'content'] as const;

function useActiveTabIndex(): number {
  const pathname = useRouterState({select: s => s.location.pathname});
  const idx = TAB_ROUTES.findIndex(r => pathname.endsWith(`/${r}`));
  return idx >= 0 ? idx : 0;
}

export type BookDetailShellProps = {
  bookInfo: BookDTO;
  children: React.ReactNode;
};

/**
 * Shell layout for book detail sub-pages.
 * Renders the tab navigation (as route links) + sidebar, with routed content as children.
 */
export const BookDetailShell: React.FC<BookDetailShellProps> = ({
  bookInfo,
  children,
}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {bookId} = useParams({strict: false}) as {bookId: string};
  const activeTab = useActiveTabIndex();

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    const route = TAB_ROUTES[newValue];
    navigate({to: `/book/$bookId/${route}`, params: {bookId}});
  };

  return (
    <Box id="book-detail">
      <Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
        <Grid container spacing={4}>
          <Grid size={{xs: 12, lg: 9}}>
            <Tabs value={activeTab} onChange={handleTabChange}>
              <Tab label={t('page.book.tabs.info')} />
              <Tab label={t('page.book.tabs.reviews')} />
              <Tab label={t('page.book.tabs.toc')} />
            </Tabs>

            <Box sx={{p: 3}}>{children}</Box>
          </Grid>

          <Grid size={{xs: 12, lg: 3}}>
            <BookDetailSidebar bookInfo={bookInfo} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
