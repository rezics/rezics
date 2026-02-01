import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Search} from '@/component/Search';
import type {SearchInfo} from '@/component/Search/searchParser';
import type {BookQueryOptions} from '@package/contract';
import {bookQueryOptionsSchema} from '@package/contract';

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
  onSearch: (options: BookQueryOptions) => void;
  defaultValue?: SearchInfo;
  hiddenWordCountFilter?: boolean;
};

export const BookSearchContainer: React.FC<BookSearchContainerProps> = ({
  onSearch,
  defaultValue,
  hiddenWordCountFilter = false,
}) => {
  const {t} = useTranslation();
  const [sort, _setSort] = useState<{
    type?: BookSortType;
    order?: 'asc' | 'desc';
  }>({order: 'desc'});

  // TODO 实际上应该由 echokv 提供data
  // const tagGroups = useMemo(
  //   () => ({
  //     presetTags: [
  //       'fiction',
  //       'nonfiction',
  //       'mystery',
  //       'romance',
  //       'history',
  //       'science',
  //       'fantasy',
  //       'philosophy',
  //     ],
  //     statusTags: [
  //       '10万字',
  //       '20万字',
  //       '50万字',
  //       '100万字',
  //       '200万字',
  //       '连载中',
  //       '已完结',
  //     ],
  //   }),
  //   [],
  // );

  const tagGroups = useMemo(() => ({}), []);

  const handleSearch = (info: SearchInfo) => {
    const options: BookQueryOptions = {
      keyword: info.keyword ?? undefined,
      tags: info.tags?.length ? info.tags : undefined,
      user: info.user ?? undefined,
      textLength: info.textLength ?? undefined,
      nsfw: info.nsfw ?? false,
      isLicensed: info.isLicensed ?? undefined,
      sort:
        sort.type || sort.order
          ? {type: sort.type as any, order: sort.order}
          : undefined,
    } as BookQueryOptions;

    // const q = toBookQueryString(options);
    onSearch(options);
  };

  return (
    <div>
      <div id="book-search-input">
        <Search.Container
          onSearch={handleSearch}
          placeholder={t('placeholders.search_books')}
          tagGroups={tagGroups}
          defaultValue={defaultValue}
          hiddenWordCountFilter={hiddenWordCountFilter}
        />
      </div>
      <div className="mt-4">
        {/* <Search.Filter
          sortType={sort.type ?? 'relevance'}
          sortOrder={sort.order ?? 'desc'}
          onSortChange={s =>
            setSort(prev => ({
              ...prev,
              ...(s.type ? {type: s.type as BookSortType} : {}),
              ...(s.order ? {order: s.order} : {}),
            }))
          }
        /> */}
      </div>
    </div>
  );
};
