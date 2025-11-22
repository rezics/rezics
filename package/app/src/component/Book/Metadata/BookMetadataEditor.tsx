import React from 'react';

import {
  Autocomplete,
  CircularProgress,
  TextField,
  Checkbox,
  Avatar,
  Chip,
  FormControlLabel,
  Tooltip,
} from '@mui/material';
import {InfoOutlined} from '@mui/icons-material';
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
        isOptionEqualToValue={(o, v) => o.unitId === v.unitId}
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
          <li {...props} key={option.unitId}>
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
              key={option.unitId}
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
  function NSFWInfo() {
    return (
      <div className="flex items-center gap-1">
        <span>NSFW</span>

        <Tooltip
          title="当书籍名称或封面包含裸露、色情等敏感内容时，请勾选此选项"
          placement="right"
          slotProps={{
            tooltip: {
              sx: {
                fontSize: '0.85rem',
                padding: '6px 10px',
                maxWidth: 300,
                lineHeight: 1.4,
              },
            },
          }}
        >
          <InfoOutlined fontSize="small" color="action" />
        </Tooltip>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      <div>
        <TextField
          fullWidth
          label="书名"
          value={value?.title ?? ''}
          onChange={e => onChange?.({title: e.target.value})}
          disabled={disabled}
          variant="outlined"
          size="small"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <TextField
            fullWidth
            label="ISBN"
            value={value?.isbn ?? ''}
            onChange={e => onChange?.({isbn: e.target.value})}
            disabled={disabled}
            variant="outlined"
            size="small"
          />
        </div>
        <div>
          <TextField
            fullWidth
            label="Cover URL"
            value={value?.coverUrl ?? ''}
            onChange={e => onChange?.({coverUrl: e.target.value})}
            disabled={disabled}
            variant="outlined"
            size="small"
          />
        </div>
      </div>
      {/* TODO add Tag string */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <UsersMultiSelect
            label="作者"
            value={(value?.author as any) ?? []}
            onChange={v => onChange?.({author: v as any})}
            placeholder="搜索作者..."
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label="出版社"
            value={(value?.press as any) ?? []}
            onChange={v => onChange?.({press: v as any})}
            placeholder="搜索出版社..."
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label="出品方"
            value={(value?.producer as any) ?? []}
            onChange={v => onChange?.({producer: v as any})}
            placeholder="搜索出品方..."
            disabled={disabled}
          />
        </div>
        <div>
          <FormControlLabel
            control={<Checkbox />}
            label={<NSFWInfo />}
            // checked={value?.nsfw ?? false}
            // onChange={e => onChange?.({nsfw: e.target.checked})}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default BookMetadataEditor;
