import {
  Autocomplete,
  Avatar,
  Box,
  Chip,
  CircularProgress,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Paper,
  Popper,
  TextField,
  Typography,
} from "@mui/material";
import { meiliUserApi } from "@rezics/api/meili/meili.api";
import type { BookDTO, UserDTO } from "@rezics/contract";
import React from "react";

type PublicUserLike = Partial<UserDTO>;

export type BookMetadataValue = Partial<BookDTO>;

export type MentionUserOption = PublicUserLike;

// ---------------------------------------------------------------------------
// Shared search hook
// ---------------------------------------------------------------------------

const useUserSearchQuery = (query: string) => {
  const [options, setOptions] = React.useState<MentionUserOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const q = query.trim();
    if (q === "") {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const { users } = await meiliUserApi.userSearch({ q, limit: 10 });
        if (active) setOptions(users as MentionUserOption[]);
      } catch {
        if (active) setOptions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(handle);
    };
  }, [query]);

  return { options, loading };
};

// ---------------------------------------------------------------------------
// Form-level multi-select (unchanged)
// ---------------------------------------------------------------------------

const useUserSearch = () => {
  const [input, setInput] = React.useState("");
  const { options, loading } = useUserSearchQuery(input);
  return { input, setInput, options, loading };
};

const UsersMultiSelect: React.FC<{
  label: string;
  value: MentionUserOption[];
  onChange: (v: MentionUserOption[]) => void;
  placeholder?: string;
  disabled?: boolean;
}> = ({ label, value, onChange, placeholder, disabled }) => {
  const { input, setInput, options, loading } = useUserSearch();
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
        getOptionLabel={(o) => o.name ?? ""}
        isOptionEqualToValue={(o, v) => o.unitId === v.unitId}
        filterOptions={(x) => x}
        loading={loading}
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            placeholder={placeholder}
            disabled={disabled}
            InputProps={{
              ...(params.InputProps as any),
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
              <Avatar src={option.avatar} sx={{ width: 24, height: 24 }}>
                {option.name?.[0] ?? "?"}
              </Avatar>
              <span>{option.name}</span>
            </div>
          </li>
        )}
        renderTags={(value, getTagProps) =>
          value.map((option, index) => (
            <Chip
              {...getTagProps({ index })}
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

export function EditorMention({
  value,
  onChange,
  disabled,
}: EditorMentionProps) {
  return (
    <UsersMultiSelect
      label="Mention"
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

// ---------------------------------------------------------------------------
// Editor mention trigger detection
// ---------------------------------------------------------------------------

export interface MentionTriggerState {
  query: string;
  from: number;
  to: number;
  anchorPos: { top: number; left: number };
}

/** Read the cursor position and check for an active `@query` pattern. */
function detectMentionTrigger(view: any): MentionTriggerState | null {
  if (!view) return null;
  try {
    const pos: number = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const lineText: string = line.text.slice(0, pos - line.from);
    const match = lineText.match(/(^|[\s\p{P}])@(\S*)$/u);
    if (!match) return null;

    const query = match[2];
    const atPos = pos - query.length - 1;
    const coords = view.coordsAtPos(atPos);
    if (!coords) return null;

    return {
      query,
      from: atPos,
      to: pos,
      anchorPos: { top: coords.bottom, left: coords.left },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// useMentionPanel — drives trigger detection, search, keyboard & selection
// ---------------------------------------------------------------------------

export function useMentionPanel(view: any) {
  const [trigger, setTrigger] = React.useState<MentionTriggerState | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const { options, loading } = useUserSearchQuery(trigger?.query ?? "");

  // Refs for use inside event handlers (stable, no stale closures)
  const triggerRef = React.useRef(trigger);
  const optionsRef = React.useRef(options);
  const activeIndexRef = React.useRef(activeIndex);
  triggerRef.current = trigger;
  optionsRef.current = options;
  activeIndexRef.current = activeIndex;

  // Reset highlight when results change
  React.useEffect(() => {
    setActiveIndex(0);
  }, []);

  const checkTrigger = React.useCallback(() => {
    setTrigger(detectMentionTrigger(view));
  }, [view]);

  // Re-check trigger on cursor movement (keyup) and clicks
  React.useEffect(() => {
    if (!view) return;
    const dom = view.dom as HTMLElement;
    const handler = () => requestAnimationFrame(() => checkTrigger());
    dom.addEventListener("keyup", handler);
    dom.addEventListener("mouseup", handler);
    return () => {
      dom.removeEventListener("keyup", handler);
      dom.removeEventListener("mouseup", handler);
    };
  }, [view, checkTrigger]);

  // Close on editor scroll (anchored coordinates go stale)
  React.useEffect(() => {
    if (!view || !trigger) return;
    const scroller = view.scrollDOM as HTMLElement;
    const close = () => setTrigger(null);
    scroller.addEventListener("scroll", close);
    return () => scroller.removeEventListener("scroll", close);
  }, [view, trigger]);

  // Keyboard interception while panel is open (capture phase)
  const pickRef = React.useRef<(o: MentionUserOption) => void>(() => {});

  React.useEffect(() => {
    if (!view || !trigger) return;
    const dom = view.dom as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!triggerRef.current) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((i) => Math.min(i + 1, optionsRef.current.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          e.stopPropagation();
          setActiveIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
        case "Tab": {
          const opt = optionsRef.current[activeIndexRef.current];
          if (opt) {
            e.preventDefault();
            e.stopPropagation();
            pickRef.current(opt);
          }
          break;
        }
        case "Escape":
          e.preventDefault();
          e.stopPropagation();
          setTrigger(null);
          break;
      }
    };

    dom.addEventListener("keydown", handleKeyDown, true);
    return () => dom.removeEventListener("keydown", handleKeyDown, true);
    // Only re-attach when the panel opens / closes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, trigger]);

  const pickMention = React.useCallback(
    (option: MentionUserOption) => {
      const t = triggerRef.current;
      if (!view || !t || !option) return;

      const text = `@${option.name ?? ""} `;
      view.dispatch({
        changes: { from: t.from, to: t.to, insert: text },
        selection: { anchor: t.from + text.length },
      });
      view.focus();
      setTrigger(null);
    },
    [view],
  );
  pickRef.current = pickMention;

  const closeMention = React.useCallback(() => setTrigger(null), []);

  return {
    trigger,
    options,
    loading,
    activeIndex,
    setActiveIndex,
    pickMention,
    closeMention,
    checkTrigger,
  };
}

// ---------------------------------------------------------------------------
// MUI Mention Panel
// ---------------------------------------------------------------------------

export interface MentionPanelProps {
  trigger: MentionTriggerState | null;
  options: MentionUserOption[];
  loading: boolean;
  activeIndex: number;
  setActiveIndex: (idx: number) => void;
  onPick: (option: MentionUserOption) => void;
  onClose: () => void;
}

export function MentionPanel({
  trigger,
  options,
  loading,
  activeIndex,
  setActiveIndex,
  onPick,
  onClose,
}: MentionPanelProps) {
  const virtualAnchorEl = React.useMemo(() => {
    if (!trigger) return null;
    const { left, top } = trigger.anchorPos;
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
  }, [trigger]);

  const isOpen = !!trigger && !!virtualAnchorEl;
  const showEmpty = !loading && options.length === 0 && !!trigger?.query;

  return (
    <Popper
      open={isOpen}
      anchorEl={virtualAnchorEl as any}
      placement="bottom-start"
      style={{ zIndex: 2000 }}
    >
      <Paper
        elevation={8}
        sx={{ minWidth: 260, maxWidth: 420, borderRadius: 2 }}
      >
        {loading && (
          <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <CircularProgress size={16} />
            <Typography variant="body2" color="text.secondary">
              Searching…
            </Typography>
          </Box>
        )}

        {showEmpty && (
          <Box sx={{ p: 1.5 }}>
            <Typography variant="body2" color="text.secondary">
              No matches
            </Typography>
          </Box>
        )}

        {options.length > 0 && (
          <List dense sx={{ maxHeight: 280, overflow: "auto", py: 0.5 }}>
            {options.map((option, idx) => (
              <ListItemButton
                key={option.unitId ?? idx}
                selected={idx === activeIndex}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onPick(option)}
                sx={{ borderRadius: 1, mx: 0.5, px: 1.5 }}
              >
                <ListItemAvatar sx={{ minWidth: 36 }}>
                  <Avatar src={option.avatar} sx={{ width: 24, height: 24 }}>
                    {option.name?.[0] ?? "?"}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={option.name ?? "(unknown)"}
                  secondary={option.unitId}
                  primaryTypographyProps={{ variant: "body2", fontWeight: 500 }}
                  secondaryTypographyProps={{ variant: "caption" }}
                />
              </ListItemButton>
            ))}
          </List>
        )}

        {isOpen && (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              display: "flex",
              justifyContent: "flex-end",
              borderTop: options.length > 0 ? "1px solid" : "none",
              borderColor: "divider",
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                userSelect: "none",
                cursor: "pointer",
                "&:hover": { color: "text.primary" },
              }}
              onClick={onClose}
            >
              Esc to close
            </Typography>
          </Box>
        )}
      </Paper>
    </Popper>
  );
}
