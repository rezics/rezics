import React from 'react';
import {useLocation} from 'wouter';
import {BookSearchContainer} from '@/component/BookLib/BookSearch/BookSearch';
import type {BookQueryOptions} from '@package/contract/src/search';

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearchContainer; on submit, navigate to /book.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const [, navigate] = useLocation();
  function handleSearch(options: BookQueryOptions) {
    let query = '?';
    if (options.keyword) {
      query += `keyword=${options.keyword}&`;
    }
    if (options.tags?.length) {
      query += `tags=${options.tags?.join(',')}&`;
    }
    if (options.nsfw) {
      query += `nsfw=true&`;
    }
    navigate(`/book${query}`);
  }
  return <BookSearchContainer onSearch={handleSearch} />;
};

export default HomeSearchBar;
