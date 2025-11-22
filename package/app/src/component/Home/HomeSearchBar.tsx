import React from 'react';
import {useLocation} from 'wouter';
import {BookSearchContainer} from '@/component/BookLib/BookSearch/BookSearch';

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearchContainer; on submit, navigate to /book.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const [, navigate] = useLocation();
  return <BookSearchContainer onSearch={() => navigate('/book')} />;
};

export default HomeSearchBar;
