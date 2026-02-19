import React, {useMemo} from 'react';
import {Alert, Button, CircularProgress, Typography} from '@mui/material';
import {useTranslation} from 'react-i18next';
import {useNavigate} from '@tanstack/react-router';
import {useQuery} from '@tanstack/react-query';
import {buildMeiliReadlistQuery} from '@package/api/meili/meili.queries';
import type {ReadlistDTO} from '@package/contract';
import {HorizontalReadListCarousel} from '@/readlist/component/list/HorizontalReadListCarousel';

export type TrendingReadListSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingReadListSection: React.FC<
  TrendingReadListSectionProps
> = ({title, limit = 8}) => {
  const {t} = useTranslation();
  const resolvedTitle = title ?? t('page.home.sections.trending_readlists');
  const navigate = useNavigate();
  const {data, isLoading, error} = useQuery(
    buildMeiliReadlistQuery(0, limit, '', []),
  );

  const items = useMemo<ReadlistDTO[]>(() => data?.readlists ?? [], [data]);

  if (error) {
    return (
      <div className="w-full">
        <Typography variant="h6" className="mb-3">
          {resolvedTitle}
        </Typography>
        <Alert severity="error">{String(error)}</Alert>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{resolvedTitle}</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({to: '/readlist'})}
        >
          更多 →
        </Button>
      </div>

      {isLoading && <CircularProgress size={20} />}

      <div>
        <HorizontalReadListCarousel readlistList={items} />
      </div>
    </div>
  );
};

export default TrendingReadListSection;
