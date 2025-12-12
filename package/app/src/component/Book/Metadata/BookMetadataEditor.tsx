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
import {meiliUserApi} from '@/api/meili/meili.api';
import {useTranslation} from 'react-i18next';

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
        const {users} = await meiliUserApi.userSearch({
          q: input,
          limit: 10,
        });
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
export function NSFWInfo({tooltipTitle}: {tooltipTitle?: string}) {
  const {t} = useTranslation();
  return (
    <div className="flex items-center gap-1">
      <span>{t('book.flags.nsfw')}</span>

      <Tooltip
        title={tooltipTitle ?? t('book.tooltips.nsfw')}
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

export function IsLicensedInfo({tooltipTitle}: {tooltipTitle?: string}) {
  const {t} = useTranslation();
  return (
    <div className="flex items-center gap-1 whitespace-nowrap">
      <span>{t('book.flags.licensed')}</span>

      <Tooltip
        title={tooltipTitle ?? t('book.tooltips.licensed')}
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

export const BookMetadataEditor: React.FC<BookMetadataEditorProps> = ({
  value,
  onChange,
  disabled,
}) => {
  const {t} = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <TextField
          fullWidth
          label={t('book.fields.title')}
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
            label={t('book.fields.isbn')}
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
            label={t('book.fields.cover_url')}
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
            label={t('book.fields.author')}
            value={(value?.author as any) ?? []}
            onChange={v => onChange?.({author: v as any})}
            placeholder={t('book.placeholders.search_author')}
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label={t('book.fields.press')}
            value={(value?.press as any) ?? []}
            onChange={v => onChange?.({press: v as any})}
            placeholder={t('book.placeholders.search_press')}
            disabled={disabled}
          />
        </div>
        <div>
          <UsersMultiSelect
            label={t('book.fields.producer')}
            value={(value?.producer as any) ?? []}
            onChange={v => onChange?.({producer: v as any})}
            placeholder={t('book.placeholders.search_producer')}
            disabled={disabled}
          />
        </div>
        <div className="flex items-center gap-2">
          <TextField
            fullWidth
            label={t('book.fields.text_length')}
            value={value?.textLength ?? ''}
            onChange={v => onChange?.({textLength: v.target.value})}
            disabled={disabled}
            variant="outlined"
            size="small"
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={value?.isLicensed ?? false}
                onChange={e =>
                  onChange?.({
                    isLicensed: e.target.checked,
                  })
                }
                disabled={disabled}
              />
            }
            label={<IsLicensedInfo />}
            disabled={disabled}
          />
          <FormControlLabel
            control={
              <Checkbox
                checked={value?.nsfw ?? false}
                onChange={e =>
                  onChange?.({
                    nsfw: e.target.checked,
                  })
                }
                disabled={disabled}
              />
            }
            label={<NSFWInfo />}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
};

export default BookMetadataEditor;
