import React from 'react';

import {
  Autocomplete,
  CircularProgress,
  TextField,
  Avatar,
  Chip,
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import type {BookDTO, UserDTO} from '@package/contract';
import {meiliUserApi} from '@package/api/meili/meili.api';

type PublicUserLike = Partial<UserDTO>;

export type BookMetadataValue = Partial<BookDTO>;

export type MentionUserOption = PublicUserLike;

const useUserSearchQuery = (query: string) => {
  const [options, setOptions] = React.useState<MentionUserOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const q = query.trim();
    if (q === '') {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const {users} = await meiliUserApi.userSearch({
          q,
          limit: 10,
        });
        if (active) setOptions(users as MentionUserOption[]);
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
  }, [query]);

  return {options, loading};
};

const useUserSearch = () => {
  const [input, setInput] = React.useState('');
  const {options, loading} = useUserSearchQuery(input);
  return {input, setInput, options, loading};
};

const UsersMultiSelect: React.FC<{
  label: string;
  value: MentionUserOption[];
  onChange: (v: MentionUserOption[]) => void;
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

interface EditorMentionProps {
  value: MentionUserOption[];
  onChange: (v: MentionUserOption[]) => void;
  disabled?: boolean;
}

export function EditorMention({value, onChange, disabled}: EditorMentionProps) {
  return (
    <UsersMultiSelect
      label="Mention"
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

export interface EditorMentionPickerProps {
  open: boolean;
  query: string;
  anchorPosition: {top: number; left: number} | null;
  activeIndex: number;
  setActiveIndex: (idx: number) => void;
  onPick: (user: MentionUserOption) => void;
  onClose: () => void;
  onOptionsChange?: (options: MentionUserOption[]) => void;
}

export function EditorMentionPicker({
  open,
  query,
  anchorPosition,
  activeIndex,
  setActiveIndex,
  onPick,
  onClose,
  onOptionsChange,
}: EditorMentionPickerProps) {
  const {options, loading} = useUserSearchQuery(query);

  React.useEffect(() => {
    onOptionsChange?.(options);
  }, [options, onOptionsChange]);

  const virtualAnchorEl = React.useMemo(() => {
    if (!anchorPosition) return null;
    const {left, top} = anchorPosition;
    return {
      getBoundingClientRect: () => ({
        x: left,
        y: top,
        top,
        left,
        right: left,
        bottom: top,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }),
    };
  }, [anchorPosition]);

  const isOpen = open && !!virtualAnchorEl;

  return (
    <Popper
      open={isOpen}
      anchorEl={virtualAnchorEl as any}
      placement="bottom-start"
      style={{zIndex: 2000}}
    >
      <Paper elevation={8} sx={{minWidth: 260, maxWidth: 420}}>
        {loading ? (
          <Box sx={{p: 1, display: 'flex', alignItems: 'center', gap: 1}}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Searching…
            </Typography>
          </Box>
        ) : null}

        {!loading && options.length === 0 ? (
          <Box sx={{p: 1}}>
            <Typography variant="body2" color="text.secondary">
              No matches
            </Typography>
          </Box>
        ) : null}

        <List dense sx={{maxHeight: 280, overflow: 'auto'}}>
          {options.map((option, idx) => (
            <ListItemButton
              key={option.unitId ?? option.name ?? idx}
              selected={idx === activeIndex}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => onPick(option)}
            >
              <ListItemAvatar>
                <Avatar src={option.avatar} sx={{width: 24, height: 24}}>
                  {option.name?.[0] ?? '?'}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={option.name ?? '(unknown)'}
                secondary={option.unitId}
              />
            </ListItemButton>
          ))}
        </List>

        {isOpen ? (
          <Box sx={{p: 0.5, display: 'flex', justifyContent: 'flex-end'}}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{userSelect: 'none'}}
              onClick={onClose}
            >
              Esc to close
            </Typography>
          </Box>
        ) : null}
      </Paper>
    </Popper>
  );
}
