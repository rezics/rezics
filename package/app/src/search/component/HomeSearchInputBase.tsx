import SearchIcon from '@mui/icons-material/Search';
import {IconButton, TextField} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';

export type HomeSearchInputBaseProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export const HomeSearchInputBase: React.FC<HomeSearchInputBaseProps> = ({
  value,
  onValueChange,
  onSubmit,
  placeholder,
  className,
}) => {
  const {t} = useTranslation();

  return (
    <div className={className}>
      <div className="flex items-center gap-2">
        <TextField
          fullWidth
          size="small"
          label={placeholder ?? t('placeholders.search_books')}
          placeholder="Title, ISBN, Author, Publisher, Producer"
          value={value}
          onChange={event => onValueChange(event.target.value)}
          onKeyDown={event => {
            if (event.key === 'Enter') {
              onSubmit(value);
            }
          }}
        />
        <IconButton
          color="primary"
          aria-label={t('accessibility.search')}
          onClick={() => onSubmit(value)}
        >
          <SearchIcon />
        </IconButton>
      </div>
    </div>
  );
};
