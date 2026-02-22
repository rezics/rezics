import {IconButton, TextField} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import {useTranslation} from 'react-i18next';
import {useState} from 'react';

export const SimpleSearchInput = ({
  onSearch,
  defaultValue,
  placeholder,
}: {
  onSearch: (value: string) => void;
  defaultValue: {keyword: string};
  placeholder: string;
}) => {
  const {t} = useTranslation();
  const [value, setValue] = useState(defaultValue);
  return (
    <div>
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          label={placeholder ?? t('placeholders.search_books')}
          placeholder="Title, ISBN, Author, Publisher, Producer"
          value={value.keyword ?? ''}
          onChange={e => setValue({...value, keyword: e.target.value})}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              onSearch(value.keyword ?? '');
            }
          }}
        />
        <IconButton
          color="primary"
          aria-label={t('accessibility.search')}
          onClick={() => onSearch(value.keyword ?? '')}
        >
          <SearchIcon />
        </IconButton>
      </div>
    </div>
  );
};
