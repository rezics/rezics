import React from 'react';
import {Alert, Button, CircularProgress, Typography} from '@mui/material';
import {useNavigate} from '@tanstack/react-router';
import {HorizontalQuoteCarousel} from '@/quote/component/list/HorizontalQuoteCarousel';
import {useHomeQuotes} from './hooks/hooks';

export type TrendingQuoteSectionProps = {
  title?: string;
  limit?: number;
};

export const TrendingQuoteSection: React.FC<TrendingQuoteSectionProps> = ({
  title,
  limit = 8,
}) => {
  const navigate = useNavigate();
  const resolvedTitle = title ?? '热门摘录';
  const {items, isLoading, error} = useHomeQuotes(limit);

  const handleMoreClick = () => {
    const first = items[0];
    if (first?.bookId) {
      navigate({to: '/quote/book/$bookId', params: {bookId: first.bookId}});
      return;
    }
    if (first?.id) {
      navigate({to: '/quote/$unitId', params: {unitId: first.id}});
      return;
    }
    navigate({to: '/review'});
  };

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
        <Button variant="text" color="primary" onClick={handleMoreClick}>
          更多 →
        </Button>
      </div>

      {isLoading && <CircularProgress size={20} />}

      {!isLoading && !items.length && (
        <Typography variant="body2" color="text.secondary">
          暂无摘录
        </Typography>
      )}

      <div>
        <HorizontalQuoteCarousel quoteList={items} />
      </div>
    </div>
  );
};

export default TrendingQuoteSection;
