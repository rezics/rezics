import React from 'react';

import Autocomplete from '@mui/material/Autocomplete';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import TextField from '@mui/material/TextField';

import type {BookDTO, UserDTO} from '@package/contract';
import {userApi} from '@/api/user/user.api';

type PublicUserLike = Partial<UserDTO>;

export type BookMetadataValue = Partial<BookDTO>;

interface BookMetadataEditorProps {
  value?: BookMetadataValue;
  onChange?: (value: BookMetadataValue) => void;
  disabled?: boolean;
}

type UserOption = PublicUserLike;

const useUserSearch = () => {
  const [input, setInput] = React.useState('');
  const [options, setOptions] = React.useState<UserOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    if (input.trim() === '') {
      setOptions([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const {users} = await userApi.list({q: input, limit: 10});
        if (active) setOptions(users as UserOption[]);
      } catch (e) {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [input]);

  return {input, setInput, options, loading};
};

const UsersMultiSelect: React.FC<{
  label: string;
  value: UserOption[];
  onChange: (v: UserOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({label, value, onChange, placeholder, disabled}) => {
  const {input, setInput, options, loading} = useUserSearch();
  return (
    <div>
      <Autocomplete
        multiple
        disableCloseOnSelect
        options={options}
        value={value}
        onChange={(_, newValue) => onChange(newValue)}
        inputValue={input}
        onInputChange={(_, v) => setInput(v)}
        getOptionLabel={o => o.name ?? ''}
        isOptionEqualToValue={(o, v) => o.id === v.id}
        filterOptions={x => x}
        loading={loading}
        renderInput={params => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? (
                    <CircularProgress color="inherit" size={16} />
                  ) : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
        renderOption={(props, option) => (
          <li {...props} key={option.id}>
            <div className="flex items-center gap-2">
              <Avatar src={option.avatar} sx={{width: 24, height: 24}}>
                {option.name?.[0] ?? '?'}
              </Avatar>
              <span>{option.name}</span>
            </div>
          </li>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({index})}
              key={option.id}
              avatar={<Avatar src={option.avatar}>{option.name?.[0]}</Avatar>}
              label={option.name}
            />
          ))
        }
        disabled={disabled}
      />
    </div>
  );
};

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const [state, setState] = React.useState<BookMetadataValue>(() => ({
    title: value?.title ?? '',
    author: value?.author ?? [],
    press: value?.press ?? [],
    producer: value?.producer ?? [],
    isbn: value?.isbn ?? '',
    coverUrl: value?.coverUrl ?? '',
  }));

  React.useEffect(() => {
    setState(prev => ({
      ...prev,
      ...(value ?? {}),
    }));
  }, [value]);

  const emit = (next: Partial<BookMetadataValue>) => {
    setState(prev => {
      const merged = {...prev, ...next};
      onChange?.(merged);
      return merged;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <TextField
          fullWidth
          label="书名"
          value={state.title ?? ''}
          onChange={e => emit({title: e.target.value})}
          disabled={disabled}
          variant="outlined"
          size="small"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <UsersMultiSelect
            label="作者"
            value={(state.author as any) ?? []}
            onChange={v => emit({author: v as any})}
            placeholder="搜索作者..."
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label="出版社"
            value={(state.press as any) ?? []}
            onChange={v => emit({press: v as any})}
            placeholder="搜索出版社..."
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label="出品方"
            value={(state.producer as any) ?? []}
            onChange={v => emit({producer: v as any})}
            placeholder="搜索出品方..."
            disabled={disabled}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <TextField
              fullWidth
              label="ISBN"
              value={state.isbn ?? ''}
              onChange={e => emit({isbn: e.target.value})}
              disabled={disabled}
              variant="outlined"
              size="small"
            />
          </div>
          <div>
            <TextField
              fullWidth
              label="Cover URL"
              value={state.coverUrl ?? ''}
              onChange={e => emit({coverUrl: e.target.value})}
              disabled={disabled}
              variant="outlined"
              size="small"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookMetadataEditor;
