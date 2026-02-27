import SearchIcon from '@mui/icons-material/Search';
import {IconButton, Paper} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useRouterState} from '@tanstack/react-router';
import {useTranslation} from 'react-i18next';
import {HomeSearchInputBase} from '../component/HomeSearchInputBase';
import {useHomeSearchNavigate} from '../hooks/useHomeSearchNavigate';
import {useHeaderSearchState} from '../state/headerSearchState';
import {useIsMobile} from '@/shared/util/use-media-query';

export const MobileHeaderSearchToggleSection: React.FC = () => {
  const {t} = useTranslation();
  const pathname = useRouterState({select: s => s.location.pathname});
  const isMobile = useIsMobile();
  const toggleMobileSearch = useHeaderSearchState(
    state => state.toggleMobileSearch,
  );

  if (!isMobile || pathname !== '/') {
    return null;
  }

  return (
    <IconButton
      aria-label={t('accessibility.search')}
      color="primary"
      onClick={toggleMobileSearch}
      sx={{ml: 1}}
    >
      <SearchIcon />
    </IconButton>
  );
};

export const MobileHeaderSearchSection: React.FC = () => {
  const {navigateByKeyword} = useHomeSearchNavigate();
  const {t} = useTranslation();
  const pathname = useRouterState({select: s => s.location.pathname});
  const isMobile = useIsMobile();
  const mobileExpanded = useHeaderSearchState(state => state.mobileExpanded);
  const closeMobileSearch = useHeaderSearchState(
    state => state.closeMobileSearch,
  );
  const [keyword, setKeyword] = useState('');

  useEffect(() => {
    if (pathname !== '/') {
      closeMobileSearch();
    }
  }, [closeMobileSearch, pathname]);

  if (!isMobile || pathname !== '/' || !mobileExpanded) {
    return null;
  }

  return (
    <Paper
      square
      elevation={1}
      sx={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 56,
        p: 1,
        borderBottom: theme => `1px solid ${theme.palette.divider}`,
      }}
    >
      <HomeSearchInputBase
        value={keyword}
        onValueChange={setKeyword}
        onSubmit={value => {
          navigateByKeyword(value);
          closeMobileSearch();
        }}
        placeholder={t('placeholders.search_books')}
      />
    </Paper>
  );
};
