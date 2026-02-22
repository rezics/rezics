import React from 'react';
import {Stack} from '@mui/material';
import {
  SearchInputContainer,
  SearchInputShow,
  type SearchInputContainerProps,
  type SearchInputShowProps,
} from './SearchInput';
import {BookSearchFilter} from './SearchFilter';
import type {SortControlsProps} from '@/component/navigation/Pagination';

export type SearchPanelShowProps = {
  inputProps: Omit<SearchInputShowProps, 'onAddTag'> & {
    onAddTag?: (tag: string) => void;
  };
  filterProps?: SortControlsProps;
};

export const SearchPanelShow: React.FC<SearchPanelShowProps> = ({
  inputProps,
  filterProps,
}) => {
  return (
    <div>
      <Stack direction="column" spacing={2}>
        <SearchInputShow {...inputProps} />
        {filterProps && <BookSearchFilter {...filterProps} />}
      </Stack>
    </div>
  );
};

export type SearchPanelContainerProps = Omit<
  SearchInputContainerProps,
  'placeholder'
> & {
  placeholder?: string;
  filterProps?: SortControlsProps;
};

export const SearchPanelContainer: React.FC<SearchPanelContainerProps> = ({
  onSearch,
  defaultValue,
  placeholder,
  tagGroups,
  filterProps,
}) => {
  return (
    <div>
      <SearchInputContainer
        onSearch={onSearch}
        defaultValue={defaultValue}
        placeholder={placeholder}
        tagGroups={tagGroups}
      />
      {filterProps && <BookSearchFilter {...filterProps} />}
    </div>
  );
};
