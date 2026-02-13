import React from 'react';
import {Tabs, Tab, Button} from '@mui/material';
import {HorizontalBookCarousel} from '@feature/book/component/list/HorizontalBookCarousel';
import {useHomeBooks} from './hooks/hooks';
import {useNavigate} from '@tanstack/react-router';

type TabKey = 'latest' | 'new' | 'completed';

export interface NewBookSectionProps {
  limit?: number;
  className?: string;
}

export const NewBookSection: React.FC<NewBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const [tab, setTab] = React.useState<TabKey>('latest');
  const navigate = useNavigate();

  // 你可以根据 tab 传不同参数，例如 status / orderBy
  const {items = [], isLoading} = useHomeBooks(limit);

  const bookList = React.useMemo(() => {
    return items.map(book => ({
      id: book.unitId,
      title: book.title,
      author: book.author?.[0]?.name ?? '',
      description: book.description,
      coverUrl: book.coverUrl ?? 'https://placehold.co/400x600?text=No+Cover',
      href: `/book/${book.unitId}`,
    }));
  }, [items]);

  return (
    <section
      className={['w-full rounded-xl px-6 py-5', className ?? ''].join(' ')}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">最新作品</h2>

        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({to: '/book'})}
        >
          更多 →
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <Tabs value={tab} onChange={(_, value) => setTab(value)}>
          <Tab value="latest" label="最新连载" />
          <Tab value="new" label="最新上架" />
          <Tab value="completed" label="完结作品" />
        </Tabs>
      </div>

      {/* Content */}
      <div>
        {isLoading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <HorizontalBookCarousel bookList={bookList} />
        )}
      </div>
    </section>
  );
};
