import SearchIcon from '@mui/icons-material/Search';
import {IconButton} from '@mui/material';
import {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {TextSearchInputBase} from './TextSearchInputBase';

export const TextSearchInputWithIcon = ({
  onSearch,
  defaultValue,
  placeholder,
}: {
  onSearch: (value: string) => void;
  defaultValue: {keyword: string};
  placeholder?: string;
}) => {
  const {t} = useTranslation();
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="flex items-center gap-2">
      <TextSearchInputBase
        value={value.keyword ?? ''}
        onValueChange={keyword => setValue({keyword})}
        onSubmit={onSearch}
        placeholder={placeholder}
        className="flex-1"
      />
      <IconButton
        color="primary"
        aria-label={t('accessibility.search')}
        onClick={() => onSearch(value.keyword ?? '')}
      >
        <SearchIcon />
      </IconButton>
    </div>
  );
};
