import {Box, Grid} from '@mui/material';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';

import type {BookDTO} from '@package/contract';

import {BookDetailSidebar} from '../component/BookDetail/BookDetailSidebar';
import {BookDetailBasicInfoTab} from '../component/BookDetail/tabs/BookDetailBasicInfoTab';
import {BookDetailReviewsTab} from '../component/BookDetail/tabs/BookDetailReviewsTab';
import {BookDetailTocTab} from '../component/BookDetail/tabs/BookDetailTocTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function BookTabPanel(props: TabPanelProps) {
  const {children, value, index, ...other} = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{p: 3}}>{children}</Box>}
    </div>
  );
}

/** Tab value type for book detail tabs. */
export type BookDetailTabValue = '0' | '1' | '2';

/** Props for BookDetailSection component. */
export type BookDetailSectionProps = {
  /** Book data to display. */
  bookInfo: BookDTO;
  activeTab: number;
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
  activeTab,
}) => {
  const {t} = useTranslation();

  const [tabValue, setTabValue] = useState(activeTab);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box id="book-detail">
      <Box maxWidth="lg" className="mt-4 mb-8 mx-auto">
        <Grid container spacing={4}>
          <Grid size={{xs: 12, lg: 9}}>
            <Tabs value={tabValue} onChange={handleTabChange}>
              <Tab label={t('page.book.tabs.basic_info')} />
              <Tab label={t('page.book.tabs.reviews')} />
              <Tab label={t('page.book.tabs.toc')} />
            </Tabs>

            <BookTabPanel value={tabValue} index={0}>
              <BookDetailBasicInfoTab bookInfo={bookInfo} />
            </BookTabPanel>
            <BookTabPanel value={tabValue} index={1}>
              <BookDetailReviewsTab bookInfo={bookInfo} />
            </BookTabPanel>
            <BookTabPanel value={tabValue} index={2}>
              <BookDetailTocTab bookInfo={bookInfo} />
            </BookTabPanel>
          </Grid>

          <Grid size={{xs: 12, lg: 3}}>
            <BookDetailSidebar bookInfo={bookInfo} />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
};
