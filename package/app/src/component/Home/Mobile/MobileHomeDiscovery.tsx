import React, {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'wouter';
import {
  meiliBookApi,
  mapUnitListToReadlistListResponse,
  mapUnitListToReviewListResponse,
} from '@/api/meili/meili.api';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {UnitType} from '@package/contract';
import type {
  BookDTO,
  ReadlistDTO,
  ReviewDTO,
  UnitListResponse,
} from '@package/contract';
import {LazyLoadImage} from '@/component/Common/LazyLoadImage';
import {useTranslation} from 'react-i18next';

type Book = BookDTO;
type Readlist = ReadlistDTO;
type Review = ReviewDTO;

type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

function useHomeBooks(limit = 8): SimpleQueryState<Book> {
  const {data, isLoading, error} = useQuery({
    queryKey: ['home', 'meili', 'books', {limit}],
    queryFn: () =>
      meiliBookApi.bookSearch({
        limit,
        sort: {type: 'createdAt', order: 'desc'},
      } as any),
    staleTime: 1000 * 60,
  });

  const items = useMemo<Book[]>(() => {
    return ((data as any)?.books ?? []) as Book[];
  }, [data]);

  return {items, total: (data as any)?.total, isLoading, error};
}

function useHomeReadlists(limit = 4): SimpleQueryState<Readlist> {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.READLIST,
      0,
      undefined,
      '',
      limit,
      (unitResp: UnitListResponse) =>
        mapUnitListToReadlistListResponse(unitResp),
    ),
  );
  return {items: data?.readlists ?? [], total: data?.total, isLoading, error};
}

function useHomeReviews(limit = 4): SimpleQueryState<Review> {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.REVIEW,
      0,
      undefined,
      '',
      limit,
      (unitResp: UnitListResponse) => mapUnitListToReviewListResponse(unitResp),
    ),
  );
  return {items: data?.reviews ?? [], total: data?.total, isLoading, error};
}

// Section Header Component
const SectionHeader: React.FC<{title: string; link?: string}> = ({
  title,
  link,
}) => (
  <div className="flex items-center justify-between mb-3 px-1">
    <h2 className="text-lg font-bold text-foreground">{title}</h2>
    {link && (
      <Link href={link} className="text-xs text-primary hover:underline">
        <I18nViewMore />
      </Link>
    )}
  </div>
);

const I18nViewMore: React.FC = () => {
  const {t} = useTranslation();
  return <>{t('common.view_more')}</>;
};

// Book Card Component
const MobileBookCard: React.FC<{book: Book}> = ({book}) => (
  <Link
    href={`/book/${book.unitId}`}
    className="block space-y-2 w-[100px] flex-shrink-0"
  >
    <div className="aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-sm">
      <LazyLoadImage
        src={book.coverUrl ?? ''}
        alt={book.title ?? ''}
        className="w-full h-full object-cover"
      />
    </div>
    <div className="space-y-0.5">
      <h3 className="text-xs font-medium line-clamp-2 leading-tight text-foreground">
        {book.title}
      </h3>
      <p className="text-[10px] text-muted-foreground line-clamp-1">
        {book.author?.[0]?.name ?? ''}
      </p>
    </div>
  </Link>
);

// Readlist Card Component
const MobileReadlistCard: React.FC<{readlist: Readlist}> = ({readlist}) => (
  <Link
    href={`/readlist/${readlist.id}`}
    className="block w-[240px] flex-shrink-0"
  >
    <div className="rounded-xl bg-card border border-border p-3 space-y-2 shadow-sm h-full">
      <h3 className="text-sm font-semibold line-clamp-1 text-foreground">
        {readlist.title}
      </h3>
      <p className="text-xs text-muted-foreground line-clamp-2 h-8">
        {readlist.content || <I18nNoDescription />}
      </p>
      <div className="flex items-center gap-2 pt-1">
        <LazyLoadImage
          src={readlist.creator?.avatar ?? ''}
          alt={readlist.creator?.name ?? ''}
          className="w-4 h-4 rounded-full bg-muted"
        />
        <span className="text-[10px] text-muted-foreground">
          {readlist.creator?.name ?? ''}
        </span>
      </div>
    </div>
  </Link>
);

const I18nNoDescription: React.FC = () => {
  const {t} = useTranslation();
  return <>{t('common.no_description')}</>;
};

// Review Card Component
const MobileReviewCard: React.FC<{review: Review}> = ({review}) => (
  <Link
    href={`/review/${review.unitId}`}
    className="block w-[240px] flex-shrink-0"
  >
    <div className="rounded-xl bg-card border border-border p-3 space-y-2 shadow-sm h-full">
      <div className="flex items-center gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold line-clamp-1 text-foreground">
            {review.title}
          </h3>
          <div className="text-[10px] text-muted-foreground">
            {review.user?.name ?? ''}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-3">
        {review.content}
      </p>
    </div>
  </Link>
);

export const MobileHomeDiscovery: React.FC = () => {
  const {t} = useTranslation();
  const {items: books} = useHomeBooks(8);
  const {items: readlists} = useHomeReadlists(4);
  const {items: reviews} = useHomeReviews(4);

  return (
    <div className="space-y-8 pb-8">
      {/* New Books */}
      <section>
        <SectionHeader title={t('book.new_releases')} link="/book" />
        <div className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {books.map(book => (
            <MobileBookCard key={book.unitId} book={book} />
          ))}
        </div>
      </section>

      {/* Readlists */}
      <section>
        <SectionHeader title={t('readlist.featured')} link="/readlist" />
        <div className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {readlists.map(readlist => (
            <MobileReadlistCard key={readlist.id} readlist={readlist} />
          ))}
        </div>
      </section>

      {/* Reviews */}
      <section>
        <SectionHeader title={t('review.hot')} link="/review" />
        <div className="flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide">
          {reviews.map(review => (
            <MobileReviewCard key={review.unitId} review={review} />
          ))}
        </div>
      </section>
    </div>
  );
};
