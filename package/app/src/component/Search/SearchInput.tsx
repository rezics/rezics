import SearchIcon from '@mui/icons-material/Search';
import {Chip, IconButton, TextField} from '@mui/material';
import {parseSearchString, type SearchInfo} from '@util/searchParser';
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';

export type SearchInputShowProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSearch: () => void;
  onAddTag?: (tag: string) => void;
  placeholder?: string; // already translated text
  tagGroups?: Record<string, string[]>; // group name -> tags
};

export const SearchInputShow: React.FC<SearchInputShowProps> = ({
  value,
  onValueChange,
  onSearch,
  onAddTag,
  placeholder,
  tagGroups,
}) => {
  const {t} = useTranslation();
  const groups = useMemo(
    () =>
      tagGroups ?? {
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
      },
    [tagGroups],
  );

  const handleKeyDown: React.KeyboardEventHandler<HTMLInputElement> = e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSearch();
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          label={placeholder ?? t('placeholders.search_books')}
          placeholder='Try: "[tag] author:John"'
          value={value}
          onChange={e => onValueChange(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <IconButton
          color="primary"
          aria-label={t('accessibility.search')}
          onClick={onSearch}
        >
          <SearchIcon />
        </IconButton>
      </div>

      {groups && Object.keys(groups).length > 0 && (
        <div className="mt-4">
          {Object.entries(groups).map(([key, tags]) => (
            <div key={key} className="flex flex-wrap gap-2 mb-2">
              <div className="font-bold">{key}</div>
              <div>
                {tags.map(tag => (
                  <Chip
                    key={tag}
                    label={tag}
                    clickable
                    variant="outlined"
                    onClick={() => onAddTag?.(tag)}
                    size="small"
                    className="cursor-pointer !mr-2"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export type SearchInputContainerProps = {
  onSearch: (info: SearchInfo, raw: string) => void;
  defaultValue?: string;
  placeholder?: string;
  tagGroups?: Record<string, string[]>;
};

export const SearchInputContainer: React.FC<SearchInputContainerProps> = ({
  onSearch,
  defaultValue = '',
  placeholder,
  tagGroups,
}) => {
  const [value, setValue] = useState(defaultValue);

  const handleSearch = () => {
    const info = parseSearchString(value);
    onSearch(info, value);
  };

  const handleAddTag = (tag: string) => {
    const withTag = value.includes(`[${tag}]`) ? value : `${value} [${tag}] `;
    setValue(withTag.trim());
  };

  return (
    <SearchInputShow
      value={value}
      onValueChange={setValue}
      onSearch={handleSearch}
      onAddTag={handleAddTag}
      placeholder={placeholder}
      tagGroups={tagGroups}
    />
  );
};
