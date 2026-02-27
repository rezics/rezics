import React from 'react';
import {useRouterState} from '@tanstack/react-router';
import {useTranslation} from 'react-i18next';
import {FullTextSearchInputWithIcon} from '../component/FullTextSearchInputWithIcon';
import {useHomeSearchNavigate} from '../hooks/useHomeSearchNavigate';
import {useIsMobile} from '@/shared/util/use-media-query';

export const DesktopHeaderSearchSection: React.FC = () => {
  const {navigateByKeyword} = useHomeSearchNavigate();
  const {t} = useTranslation();
  const pathname = useRouterState({select: s => s.location.pathname});
  const isMobile = useIsMobile();
  if (pathname !== '/' || isMobile) {
    return null;
  }

  return (
    <div className="w-full max-w-xl px-4">
      <FullTextSearchInputWithIcon
        onSearch={navigateByKeyword}
        defaultValue={{keyword: ''}}
        placeholder={t('placeholders.search_books')}
      />
    </div>
  );
};
