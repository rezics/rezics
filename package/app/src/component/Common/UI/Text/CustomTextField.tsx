import React from 'react';
import {TextField} from '@mui/material';

export function RoseTextField({
  type,
  label,
  value,
  onChange,
  multiline,
  rows,
  InputProps,
}: {
  type: string;
  label: string;
  value: string;
  multiline?: boolean;
  rows?: number;
  InputProps?: any;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <TextField
      fullWidth
      multiline={multiline}
      rows={rows}
      type={type}
      label={label}
      variant="outlined"
      value={value}
      onChange={onChange}
      className="focus-within:text-rose-500"
      InputProps={InputProps}
      slotProps={{
        inputLabel: {
          className: 'peer-focus:text-rose-500',
        },
        input: {
          className: 'focus:border-rose-500 hover:border-rose-400',
        },
      }}
    />
  );
}
