import React, {useEffect, useMemo, useRef} from 'react';
import {useNavigate, useParams, useRouterState} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {useTranslation} from 'react-i18next';
import {useAtomValue, useSetAtom} from 'jotai';

import {routeStore} from '@/global/routeStore.ts';

import {bookQueries} from '@package/api/book/book';

import {BookDetailSection, type BookDetailTabValue} from '../ui/section/BookDetailSection';
import {
  bookDetailAtomFamily,
  setBookDetailAtomFamily,
} from '../state/bookDetailAtoms';

/**
 * Book Detail Page - Route-level entry point.
 *
 * Responsibilities:
 * - Parse route parameters (bookId)
 * - Fetch book data and rating
 * - Manage tab state with URL sync
 * - Compose sections (delegates UI to BookDetailSection)
 *
 * This is a thin assembly layer that should NOT contain business logic or complex UI.
 */
export const BookDetailPage: React.FC = () => {
  const params = useParams({strict: false}) as {bookId?: string};
  const bookId = params.bookId ?? '';
  const queriesEnabled = Boolean(bookId);

  const navigate = useNavigate();
  const locationKey = useRouterState({
    select: s => s.location.pathname + s.location.searchStr,
  });
  const searchStr = useRouterState({
    select: s => s.location.searchStr,
  });
  const searchParams = useMemo(() => new URLSearchParams(searchStr), [searchStr]);
  const {t} = useTranslation();

  const getInitialTab = (): BookDetailTabValue => {
    const tabParam = searchParams.get('tab');
    if (tabParam === '0' || tabParam === '1' || tabParam === '2') {
      return tabParam as BookDetailTabValue;
    }

    const routeData = routeStore.getState().getRouteData(String(locationKey));
    const storeTab = routeData?.tab;
    if (storeTab === '0' || storeTab === '1' || storeTab === '2') {
      return storeTab as BookDetailTabValue;
    }

    return '0';
  };

  const [activeTab, setActiveTab] = React.useState<BookDetailTabValue>(getInitialTab);
  const tabRef = useRef<BookDetailTabValue>(getInitialTab());

  const handleTabChange = (_: React.SyntheticEvent | null, newValue: BookDetailTabValue) => {
    tabRef.current = newValue;
    setActiveTab(newValue);

    routeStore.getState().setRouteData(String(locationKey), {
      tab: newValue,
    });

    navigate({to: `/book/${bookId}?tab=${newValue}`});
  };

  useEffect(() => {
    routeStore.getState().setRouteData(String(locationKey), {
      tab: activeTab,
    });
  }, [locationKey, activeTab]);

  // Data fetching
  const {data, isLoading, error} = useQuery({
    ...bookQueries.detail(bookId),
    enabled: queriesEnabled,
  });
  const {data: rating} = useQuery({
    ...bookQueries.rating(bookId),
    enabled: queriesEnabled,
  });

  const ratingValue = useMemo(() => {
    const average = (rating?.totalScore || 0) / (rating?.totalCount || 1) || 0;
    return Number(average.toFixed(1));
  }, [rating]);

  // Sync fetched data to jotai atom for optimistic updates
  const setBookDetail = useSetAtom(setBookDetailAtomFamily(bookId));
  useEffect(() => {
    if (data) setBookDetail(data);
  }, [data, setBookDetail]);

  // Read from atom (allows optimistic updates) with fallback to query data
  const bookInfo = useAtomValue(bookDetailAtomFamily(bookId)) ?? data;

  // Loading states
  if (!queriesEnabled) {
    return <div>{t('common.error_generic')} Missing bookId</div>;
  }

  if (isLoading || !bookInfo) {
    return <div>{t('common.loading')}</div>;
  }

  if (error) {
    return (
      <div>
        {t('common.error_generic')} {String(error)}
      </div>
    );
  }

  return (
    <BookDetailSection
      bookInfo={bookInfo}
      rating={ratingValue || 0}
      activeTab={activeTab}
      onTabChange={handleTabChange}
    />
  );
};
