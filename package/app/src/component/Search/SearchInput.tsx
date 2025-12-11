import SearchIcon from '@mui/icons-material/Search';
import {
  Chip,
  FormControlLabel,
  IconButton,
  TextField,
  Checkbox,
} from '@mui/material';
import {type SearchInfo} from '@/component/Search/searchParser';
import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {useSearchParams, useLocation} from 'wouter';
import {
  IsLicensedInfo,
  NSFWInfo,
} from '@/component/Book/Metadata/BookMetadataEditor';

export type SearchInputShowProps = {
  value: SearchInfo;
  onValueChange: (value: SearchInfo) => void;
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
          placeholder="Title, ISBN, Author, Publisher, Producer"
          value={value.keyword ?? ''}
          onChange={e => onValueChange({...value, keyword: e.target.value})}
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
      <div className="flex items-center gap-2 mt-4">
        <TextField
          fullWidth
          size="small"
          label={'Tags'}
          placeholder="Click tags below or enter tags separated by commas"
          className="max-w-xl"
          value={
            value.tags
              ? value.tags.filter(tag => tag.trim() !== '').join(', ')
              : ''
          }
          onChange={e =>
            onValueChange({...value, tags: e.target.value.split(', ')})
          }
          onKeyDown={handleKeyDown}
        />
        <div className="flex flex-1 gap-2">
          <div className="flex-1 mr-2">
            <TextField
              fullWidth
              size="small"
              label={'Word Count'}
              placeholder='Min to Max: "10000-20000"'
              value={value.textLength ?? ''}
              onChange={e =>
                onValueChange({...value, textLength: e.target.value})
              }
              onKeyDown={handleKeyDown}
            />
          </div>
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value.nsfw}
                onChange={e =>
                  onValueChange({...value, nsfw: e.target.checked})
                }
              />
            }
            label={<NSFWInfo />}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={!!value.isLicensed}
                onChange={e =>
                  onValueChange({...value, isLicensed: e.target.checked})
                }
              />
            }
            label={<IsLicensedInfo />}
          />
        </div>
      </div>
      {/* <div className="flex items-center gap-2 mt-4">
        <TextField
          fullWidth
          size="small"
          label={'User'}
          placeholder='User or Publisher: "John"'
          value={value.user ?? ''}
          onChange={e => onValueChange({...value, user: e.target.value})}
          onKeyDown={handleKeyDown}
        />
      </div> */}

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
  onSearch: (info: SearchInfo) => void;
  defaultValue?: SearchInfo;
  placeholder?: string;
  tagGroups?: Record<string, string[]>;
};

export const SearchInputContainer: React.FC<SearchInputContainerProps> = ({
  onSearch,
  defaultValue = {keyword: '', tags: []},
  placeholder,
  tagGroups,
}) => {
  const [searchParams] = useSearchParams();
  const [location, _navigate] = useLocation();
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (location === '/book') {
      const keyword = searchParams.get('keyword');
      const tags = searchParams.get('tags')?.split(',') ?? [];
      const currentSearch = {
        keyword: keyword ?? '',
        tags: tags,
      };
      setValue(currentSearch);
      onSearch(currentSearch);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, location]);

  const handleSearch = () => {
    onSearch({
      ...value,
      tags: value.tags?.filter(tag => tag.trim() !== '') ?? [],
    });
  };

  const handleAddTag = (tag: string) => {
    setValue({...value, tags: [...(value.tags ?? []), tag]});
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
