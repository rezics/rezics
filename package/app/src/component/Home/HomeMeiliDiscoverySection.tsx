import React, {useMemo} from 'react';
import {useQuery} from '@tanstack/react-query';
import {
  Alert,
  Avatar,
  Card,
  CardContent,
  CardHeader,
  CardActionArea,
  CardMedia,
  CardActions,
  Chip,
  CircularProgress,
  Typography,
  Paper,
  Box,
  Stack,
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
import {UnitType} from '@package/contract';
import {LazyLoadImage} from '../Common/LazyLoadImage';
import {Masonry} from '@mui/lab';
import {useThrottleMasonryParameters} from '@/util/useMasonryParameters';
import {useTranslation} from 'react-i18next';
import { Link } from '@/component/Navigation/Link';

type Book = BookDTO;
type Readlist = ReadlistDTO;
type Review = ReviewDTO;
type Quote = QuoteDTO;

// compact card aesthetic handled inline where needed

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
    <div className="mb-3">
      <div className="flex items-center justify-between">
        <div>
          <Typography variant="h6" className="font-semibold">
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <CircularProgress size={18} />}
        </div>
      </div>
    </div>
  );
};

type BooksSectionProps = {
  limit?: number;
};

const BooksSection: React.FC<BooksSectionProps> = ({limit = 50}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeBooks(limit);
  const {columns, spacing} = useThrottleMasonryParameters();

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('page.home.discovery.recommended_for_you')}
          isLoading={isLoading}
        />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('page.home.discovery.recommendations')}
        subtitle={t('page.home.discovery.meili_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {/* <Masonry columns={columns} spacing={spacing}> */}
          {items.map(book => {
            if (book.coverUrl === null) {
              return null;
            }
            return (
              <div
                key={book.unitId}
                className="transition-all duration-300 ease-out"
              >
                <Card className="rounded-lg overflow-hidden shadow-sm">
                  <CardActionArea component={Link} to={`/book/${book.unitId}`}>
                    {book.coverUrl && (
                      <CardMedia
                        component="img"
                        height="180"
                        image={book.coverUrl}
                        alt={book.title}
                        className="object-cover w-full"
                      />
                    )}
                    <CardContent>
                      <Typography variant="subtitle2" className="truncate">
                        {book.title}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="truncate"
                      >
                        {(() => {
                          const a: any = (book as any).author;
                          if (!a) return '';
                          if (typeof a === 'string') return a;
                          if (Array.isArray(a))
                            return a
                              .map((x: any) =>
                                typeof x === 'string' ? x : x?.name ?? '',
                              )
                              .filter(Boolean)
                              .join(', ');
                          return (a?.name as string) ?? '';
                        })()}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </div>
            );
          })}
          {/* </Masonry> */}
        </div>
      </div>
    </div>
  );
};

type ReadlistsSectionProps = {
  limit?: number;
};

const ReadlistsSection: React.FC<ReadlistsSectionProps> = ({limit = 6}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeReadlists(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader title={t('readlist.featured')} isLoading={isLoading} />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('readlist.featured')}
        subtitle={t('page.home.discovery.featured_readlists_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(list => (
            <Card key={list.id} className="rounded-lg" elevation={1}>
              <CardActionArea component={Link} to={`/readlist/${list.id}`}>
                <CardContent className="flex gap-3 items-start">
                  {list.coverUrl && (
                    <div className="shrink-0">
                      <LazyLoadImage
                        src={list.coverUrl}
                        alt={list.title}
                        className="w-20 h-24 object-cover rounded"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <Typography variant="subtitle2" className="truncate">
                      {list.title}
                    </Typography>
                    {list.creator && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        className="line-clamp-3"
                      >
                        {list.content}
                      </Typography>
                    )}
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      className="truncate mt-1 block"
                    >
                      {list.books?.length
                        ? t('readlist.includes_books', {
                            count: list.books.length,
                          })
                        : ''}{' '}
                      {list.reviews?.length
                        ? t('readlist.includes_reviews', {
                            count: list.reviews.length,
                          })
                        : ''}
                    </Typography>
                  </div>
                </CardContent>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
};

type ReviewsSectionProps = {
  limit?: number;
};

const ReviewsSection: React.FC<ReviewsSectionProps> = ({limit = 6}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeReviews(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('review.top_rated_short_reviews')}
          isLoading={isLoading}
        />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('review.top_rated_short_reviews')}
        subtitle={t('page.home.discovery.top_rated_reviews_subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(review => (
            <Card key={review.unitId} className="rounded-lg" elevation={1}>
              <CardActionArea component={Link} to={`/review/${review.unitId}`}>
                <CardHeader
                  avatar={
                    review.user ? (
                      <Avatar
                        src={review.user.avatar ?? undefined}
                        alt={review.user.name}
                        sx={{width: 36, height: 36}}
                      />
                    ) : undefined
                  }
                  title={review.title || t('review.short_review')}
                  subheader={review.user?.name}
                />
                <CardContent>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    className="line-clamp-3 mt-1"
                  >
                    {review.content}
                  </Typography>
                </CardContent>
                <CardActions className="px-3 pb-3">
                  {typeof review.rating === 'number' && (
                    <Chip
                      size="small"
                      color="primary"
                      label={`${review.rating.toFixed(1)}`}
                    />
                  )}
                </CardActions>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      </div>
    </div>
  );
};

type QuotesSectionProps = {
  limit?: number;
};

const QuotesSection: React.FC<QuotesSectionProps> = ({limit = 6}) => {
  const {t} = useTranslation();
  const {items, error, isLoading} = useHomeQuotes(limit);

  if (error) {
    return (
      <div className="w-full">
        <SectionHeader
          title={t('quote.title')}
          subtitle={t('quote.subtitle')}
          isLoading={isLoading}
        />
        <Alert severity="error" className="mt-2">
          {String(error)}
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      <SectionHeader
        title={t('quote.title')}
        subtitle={t('quote.subtitle')}
        isLoading={isLoading}
      />
      <div className="flex-1 overflow-y-auto space-y-3 mt-3">
        <Stack spacing={2}>
          {items.map(quote => (
            <Card key={quote.id} className="rounded-lg" elevation={1}>
              <CardActionArea component={Link} to={`/quote/${quote.id}`}>
                <CardContent>
                  <Typography
                    variant="body1"
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
        </Stack>
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
      className={`${className} p-4 lg:h-[42rem] rounded-lg`}
      sx={{
        height: '32rem',
        backgroundColor: 'transparent',
      }}
      elevation={0}
    >
      <Box className="h-full bg-surface rounded-lg p-3 shadow-sm">
        {children}
      </Box>
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
> = ({bookLimit = 50, readlistLimit = 6, reviewLimit = 6, quoteLimit = 6}) => {
  return (
    <div className="mt-8 space-y-6">
      {/* 第一行：为你推荐 + 精选书单 */}
      {/* 使用 lg:h-[42rem] 这样的固定高度值来“锁死”布局 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LockedPanel>
            {/* 增加 limit 以利用滚动空间 */}
            <BooksSection limit={bookLimit} />
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
