import {TabContext, TabList, TabPanel} from '@mui/lab';
import {Box, Grid, Tab} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';

import type {BookDTO} from '@package/contract';
import {BookHeroSection} from './BookHeroSection';
import {BookDetailSidebar} from '../component/BookDetail/BookDetailSidebar';
import {BookDetailBasicInfoTab} from '../component/BookDetail/tabs/BookDetailBasicInfoTab';
import {BookDetailReviewsTab} from '../component/BookDetail/tabs/BookDetailReviewsTab';
import {BookDetailTocTab} from '../component/BookDetail/tabs/BookDetailTocTab';

/** Tab value type for book detail tabs. */
export type BookDetailTabValue = '0' | '1' | '2';

/** Props for BookDetailSection component. */
export type BookDetailSectionProps = {
  /** Book data to display. */
  bookInfo: BookDTO;
  /** Book rating value (0-10). */
  rating: number;
  /** Currently active tab. */
  activeTab: BookDetailTabValue;
  /** Callback when tab changes. */
  onTabChange: (event: React.SyntheticEvent | null, newValue: BookDetailTabValue) => void;
};

/**
 * Book Detail Section - Main content area for book detail page.
 *
 * Composes:
 * - BookHeroSection (hero banner with cover, title, rating)
 * - Tab panels (basic info, reviews, table of contents)
 * - Sidebar with book metadata
 *
 * This is a section-level component that can be composed by the page layer.
 */
export const BookDetailSection: React.FC<BookDetailSectionProps> = ({
  bookInfo,
  rating,
  activeTab,
  onTabChange,
}) => {
  const {t} = useTranslation();

  return (
    <Box id="book-detail">
      <BookHeroSection bookInfo={bookInfo} rating={rating} />

      <Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
        <Grid container spacing={4}>
          <Grid size={{xs: 12, lg: 9}}>
            <TabContext value={activeTab}>
              <TabList onChange={onTabChange}>
                <Tab label={t('page.book.tabs.basic_info')} value="0" />
                <Tab label={t('page.book.tabs.reviews')} value="1" />
                <Tab label={t('page.book.tabs.toc')} value="2" />
              </TabList>

              <TabPanel value="0">
                <BookDetailBasicInfoTab bookInfo={bookInfo} />
              </TabPanel>
              <TabPanel value="1">
                <BookDetailReviewsTab bookInfo={bookInfo} />
              </TabPanel>
              <TabPanel value="2">
                <BookDetailTocTab bookInfo={bookInfo} />
              </TabPanel>
            </TabContext>
          </Grid>

          <Grid size={{xs: 12, lg: 3}}>
            <BookDetailSidebar bookInfo={bookInfo} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};

