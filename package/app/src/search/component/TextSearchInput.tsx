import React, {useRef, useState} from 'react';
import {TextSearchInputBase} from './TextSearchInputBase';
import {SearchSuggestions} from './SearchSuggestions';
import {cn} from '@/shared/util/css-util';

export type TextSearchInputProps = {
  onSearch: (value: string) => void;
  defaultValue: {keyword: string};
  placeholder?: string;
  enableSuggestions?: boolean;
  className?: string;
  startAdornmentIcon?: React.ReactNode;
};

export const TextSearchInput = ({
  onSearch,
  defaultValue,
  placeholder,
  enableSuggestions = false,
  className,
  startAdornmentIcon,
}: TextSearchInputProps) => {
  const rootRef = useRef<HTMLDivElement>(null);

  const [value, setValue] = useState(defaultValue);
  const [openSuggestion, setOpenSuggestion] = useState(false);

  const keyword = value.keyword ?? '';

  const handleValueChange = (keyword: string) => {
    setValue({keyword});
    setOpenSuggestion(true);
  };

  const handleSubmit = (keyword: string) => {
    setOpenSuggestion(false);
    onSearch(keyword);
  };

  const handleSelectSuggestion = (keyword: string) => {
    setValue({keyword});
    setOpenSuggestion(false);
    onSearch(keyword);
  };

  return (
    <div
      className={cn('relative', className)}
      ref={rootRef}
      onBlur={event => {
        const nextFocus = event.relatedTarget as Node | null;

        // if focus moves to internal element, do not close
        if (rootRef.current?.contains(nextFocus)) {
          return;
        }

        setOpenSuggestion(false);
      }}
    >
      <TextSearchInputBase
        value={keyword}
        onValueChange={handleValueChange}
        onSubmit={handleSubmit}
        placeholder={placeholder}
        className="w-full"
        startAdornmentIcon={startAdornmentIcon}
      />

      {enableSuggestions && openSuggestion && (
        <SearchSuggestions
          keyword={keyword}
          onSelect={handleSelectSuggestion}
        />
      )}
    </div>
  );
};
