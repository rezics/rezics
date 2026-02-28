import {InputAdornment, TextField} from '@mui/material';
import React, {useState} from 'react';

export type TextSearchInputBaseProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (value: string) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  startAdornmentIcon?: React.ReactNode;
};

export const TextSearchInputBase: React.FC<TextSearchInputBaseProps> = ({
  value,
  onValueChange,
  onSubmit,
  label,
  placeholder,
  className,
  startAdornmentIcon,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <div className={className}>
      <TextField
        fullWidth
        size="small"
        label={label ?? ''}
        placeholder={placeholder ?? 'Find anything'}
        value={value}
        onChange={event => onValueChange(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                {startAdornmentIcon}
              </InputAdornment>
            ),
          },
        }}
        onKeyDown={event => {
          /**
           * 防止中文 / 日文 IME 输入时误触 Enter
           */
          if (event.nativeEvent.isComposing) return;

          /**
           * 仅在 focus 时触发 search
           */
          if (focused && event.key === 'Enter') {
            event.preventDefault();
            onSubmit(value);
          }
        }}
      />
    </div>
  );
};
