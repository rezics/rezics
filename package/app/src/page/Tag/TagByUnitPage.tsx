import {useQueries, useQuery} from '@tanstack/react-query';
import {Link} from 'wouter';
import {AccentBarWithTextShow} from '@/component/Common/AccentBar.tsx';
import {tagApi, tagQueries} from '@/api/tag';
import type {TagDetailDTO} from '@package/contract';
import {TagList} from '@/component/Tag/TagList';

interface TagByBookPageProps {
  bookId: string;
  domainId?: string;
  full?: boolean; // render full page version
}

export function TagByBookPage({
  bookId,
  domainId,
  full = false,
}: TagByBookPageProps) {
  // List tags attached to this book (object)
  const pageSize = full ? 100 : 30;
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
  const showSeeAll = !full && total > pageSize;

  return (
    <div className="w-11/12 mx-auto mt-10">
      <AccentBarWithTextShow text={`标签`} />

      {isLoading && <div>加载中…</div>}
      {error && <div>加载失败</div>}

      {!isLoading && !error && (
        <div className="mt-4">
          <TagList
            tags={details}
            onDomainClick={d => {
              // navigate to domain-specific page
              window.location.href = `/tag/book/${bookId}/tags/${d}`;
            }}
          />
        </div>
      )}

      {showSeeAll && (
        <div className="mt-4">
          <Link href={`/tag/book/${bookId}/tags`}>
            <span className="text-primary-600 hover:underline">
              查看全部标签（{total}）
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}

export function TagByBookFullPage(props: {bookId: string; domainId?: string}) {
  return <TagByBookPage {...props} full />;
}
