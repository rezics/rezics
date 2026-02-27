import {TextField} from '@mui/material';
import React from 'react';
import {useTranslation} from 'react-i18next';

export type FullTextSearchInputBaseProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export const FullTextSearchInputBase: React.FC<
  FullTextSearchInputBaseProps
> = ({value, onValueChange, onSubmit, placeholder, className}) => {
  const {t} = useTranslation();

  return (
    <div className={className}>
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
    </div>
  );
};
