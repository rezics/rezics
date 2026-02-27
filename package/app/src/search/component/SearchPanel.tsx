import React from 'react';
import {Stack} from '@mui/material';
import {
  SearchInput,
  SearchInputView,
  type SearchInputProps,
  type SearchInputViewProps,
} from './SearchInput';
import {BookSearchFilter} from './SearchFilter';
import type {SortControlsProps} from '@package/ui/composite/pagination/Pagination.tsx';

export type SearchPanelViewProps = {
  inputProps: Omit<SearchInputViewProps, 'onAddTag'> & {
    onAddTag?: (tag: string) => void;
  };
  filterProps?: SortControlsProps;
};

export const SearchPanelView: React.FC<SearchPanelViewProps> = ({
  inputProps,
  filterProps,
}) => {
  return (
    <div>
      <Stack direction="column" spacing={2}>
        <SearchInputView {...inputProps} />
        {filterProps && <BookSearchFilter {...filterProps} />}
      </Stack>
    </div>
  );
};

export type SearchPanelProps = Omit<SearchInputProps, 'placeholder'> & {
  placeholder?: string;
  filterProps?: SortControlsProps;
};

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  defaultValue,
  placeholder,
  tagGroups,
  filterProps,
}) => {
  return (
    <div>
      <SearchInput
        onSearch={onSearch}
        defaultValue={defaultValue}
        placeholder={placeholder}
        tagGroups={tagGroups}
      />
      {filterProps && <BookSearchFilter {...filterProps} />}
    </div>
  );
};
