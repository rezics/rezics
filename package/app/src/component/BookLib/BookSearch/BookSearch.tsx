import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Search} from '@/component/Search';
import type {SearchInfo} from '@util/searchParser';
import type {BookQueryOptions} from '@package/contract/src/search';
import {bookQueryOptionsSchema} from '@package/contract/src/search';
import {toBookQueryString} from '@package/contract/src/search';

export type BookSortType =
  | 'relevance'
  | 'createdAt'
  | 'updatedAt'
  | 'favorites'
  | 'wordCount'
  | 'monthlyVotes'
  | 'recommendation'
  | 'custom';

export type BookSearchContainerProps = {
  onSearch: (options: BookQueryOptions, q: string) => void;
};

export const BookSearchContainer: React.FC<BookSearchContainerProps> = ({
  onSearch,
}) => {
  const {t} = useTranslation();
  const [sort, setSort] = useState<{
    type?: BookSortType;
    order?: 'asc' | 'desc';
  }>({order: 'desc'});

  const tagGroups = useMemo(
    () => ({
      presetTags: [
        'fiction',
        'nonfiction',
        'mystery',
        'romance',
        'history',
        'science',
        'fantasy',
        'philosophy',
      ],
      statusTags: [
        '10万字',
        '20万字',
        '50万字',
        '100万字',
        '200万字',
        '连载中',
        '已完结',
      ],
    }),
    [],
  );

  const handleSearch = (info: SearchInfo, _raw: string) => {
    const options: BookQueryOptions = {
      keyword: info.searchText || undefined,
      tags: info.searchTags.length ? info.searchTags : undefined,
      sort:
        sort.type || sort.order
          ? {type: sort.type as any, order: sort.order}
          : undefined,
    } as BookQueryOptions;

    // schema referenced (validation optional at runtime)
    void bookQueryOptionsSchema;
    const q = toBookQueryString(options);
    onSearch(options, q);
  };

  return (
    <div>
      <div id="book-search-input">
        <Search.Container
          onSearch={handleSearch}
          placeholder={t('placeholders.search_books')}
          tagGroups={tagGroups}
        />
      </div>
      <div className="mt-4">
        <Search.Filter
          sortType={sort.type ?? 'relevance'}
          sortOrder={sort.order ?? 'desc'}
          onSortChange={s =>
            setSort(prev => ({
              ...prev,
              ...(s.type ? {type: s.type as BookSortType} : {}),
              ...(s.order ? {order: s.order} : {}),
            }))
          }
        />
      </div>
    </div>
  );
};
