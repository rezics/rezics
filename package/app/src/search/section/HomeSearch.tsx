import React from 'react';
import {useRouterState} from '@tanstack/react-router';
import {TextSearchInput} from '../component/TextSearchInput';
import {useHomeSearchNavigate} from '../hooks/useHomeSearchNavigate';
import SearchIcon from '@mui/icons-material/Search';
import {useTheme} from '@mui/material/styles';

export const HomeSearch: React.FC<{className?: string}> = ({className}) => {
  const theme = useTheme();
  const pathname = useRouterState({
    select: s => s.location.pathname,
  });
  const {navigateByKeyword} = useHomeSearchNavigate();

  if (pathname !== '/') {
    return null;
  }

  return (
    <div className={className}>
      <TextSearchInput
        defaultValue={{keyword: ''}}
        onSearch={navigateByKeyword}
        enableSuggestions={true}
        startAdornmentIcon={
          <SearchIcon sx={{color: theme.palette.primary.main}} />
        }
      />
    </div>
  );
};
