import React from 'react';
import {useLocation} from 'wouter';
import {BookSearchContainer} from '@/component/BookLib/BookSearch/BookSearch';

export type HomeSearchBarProps = object;

/**
 * HomeSearchBar
 * Wraps the BookSearchContainer; on submit, navigate to /books.
 */
export const HomeSearchBar: React.FC<HomeSearchBarProps> = () => {
  const [, navigate] = useLocation();
  return <BookSearchContainer onSearch={() => navigate('/books')} />;
};

export default HomeSearchBar;
