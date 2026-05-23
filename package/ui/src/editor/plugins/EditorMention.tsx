import React from "react";
import { createPortal } from "react-dom";
import { Avatar, AvatarFallback, AvatarImage } from "#/shadcn/avatar";
import { Spinner } from "#/primitive/feedback/Spinner";

export interface MentionUserOption {
  userId?: string;
  name?: string | null;
  avatar?: string | null;
}

export type UserSearchAdapter = (query: string) => Promise<MentionUserOption[]>;

// ---------------------------------------------------------------------------
// Shared search hook
// ---------------------------------------------------------------------------

const useUserSearchQuery = (query: string, userSearch?: UserSearchAdapter) => {
  const [options, setOptions] = React.useState<MentionUserOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const q = query.trim();
    if (q === "" || !userSearch) {
      setOptions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const users = await userSearch(q);
        if (active) setOptions(users);
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
  }, [query, userSearch]);

  return { options, loading };
};

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

export function useMentionPanel(view: any, userSearch?: UserSearchAdapter) {
  const [trigger, setTrigger] = React.useState<MentionTriggerState | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = React.useState(0);
  const { options, loading } = useUserSearchQuery(
    trigger?.query ?? "",
    userSearch,
  );

  // Refs for use inside event handlers (stable, no stale closures)
  const triggerRef = React.useRef(trigger);
  const optionsRef = React.useRef(options);
  const activeIndexRef = React.useRef(activeIndex);
  triggerRef.current = trigger;
  optionsRef.current = options;
  activeIndexRef.current = activeIndex;

  React.useEffect(() => {
    setActiveIndex(0);
  }, []);

  const checkTrigger = React.useCallback(() => {
    setTrigger(detectMentionTrigger(view));
  }, [view]);

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

  React.useEffect(() => {
    if (!view || !trigger) return;
    const scroller = view.scrollDOM as HTMLElement;
    const close = () => setTrigger(null);
    scroller.addEventListener("scroll", close);
    return () => scroller.removeEventListener("scroll", close);
  }, [view, trigger]);

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
// Mention Panel — portal-rendered floating list
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
  if (!trigger) return null;

  const showEmpty = !loading && options.length === 0 && !!trigger.query;
  const { left, top } = trigger.anchorPos;

  return createPortal(
    <div
      className="fixed z-[2000] min-w-[260px] max-w-[420px] rounded-lg shadow-lg bg-rezics-surface-elevated border border-border-whisper"
      style={{ top, left }}
    >
      {loading && (
        <div className="flex items-center gap-2 p-3">
          <Spinner size="sm" />
          <span className="text-sm text-rezics-fg-muted">Searching…</span>
        </div>
      )}

      {showEmpty && (
        <div className="p-3">
          <span className="text-sm text-rezics-fg-muted">No matches</span>
        </div>
      )}

      {options.length > 0 && (
        <ul className="max-h-[280px] overflow-auto py-1 list-none m-0 p-0">
          {options.map((option, idx) => (
            <li key={option.userId ?? idx}>
              <button
                type="button"
                className={[
                  "w-full text-left flex items-center gap-2 px-3 py-1.5 mx-1 rounded-md",
                  idx === activeIndex
                    ? "bg-rezics-surface-subtle"
                    : "hover:bg-rezics-surface-subtle",
                ].join(" ")}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => onPick(option)}
              >
                <Avatar className="size-6">
                  {option.avatar && <AvatarImage src={option.avatar} />}
                  <AvatarFallback>{option.name?.[0] ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-medium truncate">
                    {option.name ?? "(unknown)"}
                  </span>
                  {option.userId && (
                    <span className="text-xs text-rezics-fg-muted truncate">
                      {option.userId}
                    </span>
                  )}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={[
          "px-3 py-1 flex justify-end",
          options.length > 0 ? "border-t border-border-whisper" : "",
        ].join(" ")}
      >
        <button
          type="button"
          className="text-xs text-rezics-fg-muted select-none hover:text-rezics-fg-primary"
          onClick={onClose}
        >
          Esc to close
        </button>
      </div>
    </div>,
    document.body,
  );
}
