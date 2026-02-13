import React from 'react';
import {useNavigate} from '@tanstack/react-router';
import {BookSearchInput} from '@feature/book/library/ui/component/BookSearch/BookSearch';
import type {BookQueryOptions} from '@package/contract';

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearchContainer; on submit, navigate to /book.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const navigate = useNavigate();
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
    if (options.isLicensed) {
      query += `isLicensed=true&`;
    }
    navigate({to: `/book${query}`});
  }
  return (
    <BookSearchInput onSearch={handleSearch} hiddenWordCountFilter={true} />
  );
};

export default HomeSearchBar;
