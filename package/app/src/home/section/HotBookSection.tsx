import React from 'react';
import {ResponsiveBookGridLimited} from '@/book-library/component/list/ResponsiveBookGridLimited';
import {useHomeBooks} from './hooks/hooks';
import {Button} from '@mui/material';
import {useNavigate} from '@tanstack/react-router';

export interface HotBookSectionProps {
  limit?: number;
  className?: string;
}

export const HotBookSection: React.FC<HotBookSectionProps> = ({
  limit = 12,
  className,
}) => {
  const navigate = useNavigate();
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
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">热门作品</h2>
        <Button
          variant="text"
          color="primary"
          onClick={() => navigate({to: '/book'})}
        >
          更多 →
        </Button>
      </div>
      {isLoading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : (
        <ResponsiveBookGridLimited bookList={bookList} />
      )}
    </section>
  );
};
