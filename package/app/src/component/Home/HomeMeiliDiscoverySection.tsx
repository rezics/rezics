import React, {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Typography,
  CardActionArea,
  Paper,
} from '@mui/material';
import type {
  BookDTO,
  ReadlistDTO,
  ReviewDTO,
  QuoteDTO,
  UnitListResponse,
} from '@package/contract';
import {
  meiliBookApi,
  mapUnitListToReadlistListResponse,
  mapUnitListToReviewListResponse,
} from '@/api/meili/meili.api';
import {buildMeiliUnitQuery} from '@/api/meili/meili.queries';
import {UnitType} from '@package/contract/src/unit';
import {Link} from 'wouter';
import BookCard from './HomeBookCard';

type Book = BookDTO;
type Readlist = ReadlistDTO;
type Review = ReviewDTO;
type Quote = QuoteDTO;

const SECTION_CARD_CLASS =
  'overflow-hidden border border-solid border-gray-100 shadow-sm bg-white';

type SimpleQueryState<T> = {
  items: T[];
  total?: number;
  isLoading: boolean;
  error: unknown;
};

function useHomeBooks(limit = 12): SimpleQueryState<Book> {
  const {data, isLoading, error} = useQuery({
    queryKey: [
      'home',
      'meili',
      'books',
      {
        limit,
      },
    ],
    queryFn: () =>
      meiliBookApi.bookSearch({
        limit,
        sort: {type: 'createdAt', order: 'desc'},
      } as any),
    staleTime: 1000 * 60,
  });

  const items = useMemo<Book[]>(() => {
    // Meili book search returns a list compatible with BookListResponse
    // so we safely access `books`.
    return ((data as any)?.books ?? []) as Book[];
  }, [data]);

  const total: number | undefined = (data as any)?.total;

  return {items, total, isLoading, error};
}

function useHomeReadlists(limit = 6): SimpleQueryState<Readlist> {
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

  const items = useMemo<Readlist[]>(() => data?.readlists ?? [], [data]);
  const total: number | undefined = data?.total;

  return {items, total, isLoading, error};
}

function useHomeReviews(limit = 6): SimpleQueryState<Review> {
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

  const items = useMemo<Review[]>(() => data?.reviews ?? [], [data]);
  const total: number | undefined = data?.total;

  return {items, total, isLoading, error};
}

function useHomeQuotes(limit = 6): SimpleQueryState<Quote> {
  const {data, isLoading, error} = useQuery(
    buildMeiliUnitQuery(
      UnitType.QUOTE,
      0,
      undefined,
      '',
      limit,
      (unitResp: UnitListResponse) =>
        ({
          quotes: (unitResp.units ?? []).map(unit => ({
            id: unit.id,
            text: (unit.content as string) ?? '',
            from: unit.title ?? undefined,
            bookId: unit.targetUnitId ?? undefined,
            created_at:
              typeof unit.createdAt === 'string'
                ? unit.createdAt
                : unit.createdAt?.toString(),
          })),
          total: unitResp.total,
        } as {quotes: Quote[]; total?: number}),
    ),
  );

  const items = useMemo<Quote[]>(() => data?.quotes ?? [], [data]);
  const total: number | undefined = data?.total;

  return {items, total, isLoading, error};
}

type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
};

const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  subtitle,
  isLoading,
}) => {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <div>
        <Typography variant="h6">{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </div>
      {isLoading && <CircularProgress size={18} />}
    </div>
  );
};

type BooksSectionProps = {
  limit?: number;
};

const BooksSection: React.FC<BooksSectionProps> = ({limit = 12}) => {
  const {items, error, isLoading} = useHomeBooks(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title="为你推荐" isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title="推荐"
        subtitle="基于 Meilisearch 的实时推荐书单"
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map(book => (
            <BookCard key={book.unitId} book={book} />
          ))}
        </div>
      </div>
    </div>
  );
};

type ReadlistsSectionProps = {
  limit?: number;
};

const ReadlistsSection: React.FC<ReadlistsSectionProps> = ({limit = 6}) => {
  const {items, error, isLoading} = useHomeReadlists(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title="精选书单" isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title="精选书单"
        subtitle="来自用户与编辑整理的主题阅读集"
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        {items.map(list => (
          <Card key={list.id} className={SECTION_CARD_CLASS}>
            <CardActionArea component={Link} to={`/readlist/${list.id}`}>
              <CardContent className="flex gap-3">
                {list.coverUrl && (
                  <div className="shrink-0">
                    <img
                      src={list.coverUrl}
                      alt={list.title}
                      className="w-16 h-20 object-cover rounded"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate mb-1" title={list.title}>
                    {list.title}
                  </div>
                  {list.creator && (
                    <div className="mb-1">
                      {/* <Avatar
                        src={list.creator.avatar ?? undefined}
                        alt={list.creator.name}
                        sx={{width: 20, height: 20}}
                        className="float-left mr-2 mb-1"
                      /> */}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="line-clamp-3"
                      >
                        {list.content}
                      </Typography>
                    </div>
                  )}
                  {list.books?.length > 0 && (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className="truncate"
                    >
                      包含 {list.books.length} 本书 ·{' '}
                      {list.reviews?.length
                        ? `${list.reviews.length} 条短评`
                        : ''}
                    </Typography>
                  )}
                </div>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </div>
    </div>
  );
};

type ReviewsSectionProps = {
  limit?: number;
};

const ReviewsSection: React.FC<ReviewsSectionProps> = ({limit = 6}) => {
  const {items, error, isLoading} = useHomeReviews(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title="高赞短评" isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title="高赞短评"
        subtitle="看看大家最近在聊些什么"
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        {items.map(review => (
          <Card key={review.unitId} className={SECTION_CARD_CLASS}>
            <CardActionArea component={Link} to={`/review/${review.unitId}`}>
              <CardContent>
                <div className="flex items-center gap-2 mb-1">
                  {review.user && (
                    <Avatar
                      src={review.user.avatar ?? undefined}
                      alt={review.user.name}
                      sx={{width: 24, height: 24}}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <Typography
                      variant="subtitle2"
                      className="truncate"
                      title={review.title ?? review.content}
                    >
                      {review.title || '短评'}
                    </Typography>
                    {review.user && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="truncate"
                      >
                        {review.user.name}
                      </Typography>
                    )}
                  </div>
                  {typeof review.rating === 'number' && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${review.rating.toFixed(1)}`}
                    />
                  )}
                </div>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  className="line-clamp-3 mt-1"
                >
                  {review.content}
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </div>
    </div>
  );
};

type QuotesSectionProps = {
  limit?: number;
};

const QuotesSection: React.FC<QuotesSectionProps> = ({limit = 6}) => {
  const {items, error, isLoading} = useHomeQuotes(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title="金句摘录" isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title="金句摘录"
        subtitle="从阅读中摘下的一点光"
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        {items.map(quote => (
          <Card key={quote.id} className={SECTION_CARD_CLASS}>
            <CardActionArea component={Link} to={`/quote/${quote.id}`}>
              <CardContent>
                <Typography
                  variant="body2"
                  className="mb-1"
                  color="text.primary"
                >
                  “{quote.text}”
                </Typography>
                {quote.from && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    className="truncate"
                  >
                    —— {quote.from}
                  </Typography>
                )}
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </div>
    </div>
  );
};

const LockedPanel: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({children, className}) => {
  return (
    <Paper
      className={`${className} p-4`}
      sx={{
        height: '32rem',
        '@media (min-width: 1024px)': {
          height: '42rem',
        },
      }}
    >
      {children}
    </Paper>
  );
};

export type HomeMeiliDiscoverySectionProps = {
  bookLimit?: number;
  readlistLimit?: number;
  reviewLimit?: number;
  quoteLimit?: number;
};

/**
 * HomeMeiliDiscoverySection
 * - 基于 Meilisearch 的统一发现区：
 *   - Book list
 *   - Readlist list
 *   - Review list
 *   - Quote list
 * - 布局全部使用 Tailwind，视觉样式继承 MUI 组件
 */
export const HomeMeiliDiscoverySection: React.FC<
  HomeMeiliDiscoverySectionProps
> = ({bookLimit = 12, readlistLimit = 6, reviewLimit = 6, quoteLimit = 6}) => {
  return (
    <div className="mt-8 space-y-6">
      {/* 第一行：为你推荐 + 精选书单 */}
      {/* 使用 lg:h-[42rem] 这样的固定高度值来“锁死”布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LockedPanel>
            {/* 增加 limit 以利用滚动空间 */}
            <BooksSection limit={bookLimit || 16} />
          </LockedPanel>
        </div>
        <div className="lg:col-span-1">
          <LockedPanel>
            <ReadlistsSection limit={readlistLimit || 8} />
          </LockedPanel>
        </div>
      </div>

      {/* 第二行：高赞短评 + 金句摘录 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LockedPanel>
            <ReviewsSection limit={reviewLimit || 8} />
          </LockedPanel>
        </div>
        <div className="lg:col-span-1">
          <LockedPanel>
            <QuotesSection limit={quoteLimit || 8} />
          </LockedPanel>
        </div>
      </div>
    </div>
  );
};

export default HomeMeiliDiscoverySection;
