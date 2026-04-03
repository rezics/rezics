import {useQueries, useQuery} from '@tanstack/react-query';
import {MUILink} from '@rezics/ui/primitive/link/MUILink.tsx';
import {AccentBarWithText} from '@rezics/ui/composite/typography/AccentBarWithText.tsx';
import {tagApi, tagQueries} from '@rezics/api/tag/tag';
import type {TagDetailDTO} from '@rezics/contract';
import {TagWrapper} from '../component/TagWrapper';
import {tagBookRoute} from '@/router';
import {useMatchRoute} from '@tanstack/react-router';

export function TagByBookPage() {
  const {bookId} = tagBookRoute.useParams();
  // List tags attached to this book (object)
  const pageSize = 30;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(tagQueries.list({objectId: bookId, page: 1, limit: pageSize}));

  // Fetch details to get domains for grouping
  const tagIds = listData?.tags?.map(t => t.id) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map(id => ({
      queryKey: ['tag', 'detail', id],
      queryFn: () => tagApi.get(id),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const _details: TagDetailDTO[] = detailsResults
    .map(r => r.data)
    .filter(Boolean) as TagDetailDTO[];

  const total = listData?.total ?? 0;
  const showSeeAll = total > pageSize;

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithText text={`标签`} />

      {isLoading && <div>加载中…</div>}
      {error && <div>加载失败</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{objectId: bookId}}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      {showSeeAll && (
        <div className="mt-4">
          <MUILink to="/tag/book/$bookId/tag" params={{bookId}}>
            <span className="text-primary-600 hover:underline">
              查看全部标签（{total}）
            </span>
          </MUILink>
        </div>
      )}
    </div>
  );
}

export function TagByBookFullPage() {
  const matchRoute = useMatchRoute();
  const withDomain = matchRoute({
    to: '/tag/book/$bookId/tag/$domainId',
    fuzzy: false,
  });
  const base = matchRoute({to: '/tag/book/$bookId/tag', fuzzy: false});

  const bookId =
    (withDomain ? withDomain.bookId : '') || (base ? base.bookId : '') || '';
  const domainId = withDomain ? withDomain.domainId : undefined;

  // List tags attached to this book (object)
  const pageSize = 100;
  const {
    data: listData,
    isLoading,
    error,
  } = useQuery(
    tagQueries.list({objectId: bookId, domainId, page: 1, limit: pageSize}),
  );

  // Fetch details to get domains for grouping
  const tagIds = listData?.tags?.map(t => t.id) ?? [];
  const detailsResults = useQueries({
    queries: tagIds.map(id => ({
      queryKey: ['tag', 'detail', id],
      queryFn: () => tagApi.get(id),
      staleTime: 1000 * 60 * 10,
    })),
  });

  const details: TagDetailDTO[] = detailsResults
    .map(r => r.data)
    .filter(Boolean) as TagDetailDTO[];

  const total = listData?.total ?? 0;

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithText text={`标签`} />

      {isLoading && <div>加载中…</div>}
      {error && <div>加载失败</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagWrapper
            filters={{objectId: bookId, domainId}}
            mode="grouped"
            renderAll={true}
          />
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        total: {total} {details?.length ? `(details: ${details.length})` : ''}
      </div>
    </div>
  );
}
