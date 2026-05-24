import type {
  MarkdownEditorProps,
  ResizeConfig,
  ToolbarOverride,
  ViewMode,
} from "@rezics/editor/editor";
import { MarkdownEditor } from "@rezics/editor/editor";
import { insertImageUrl } from "@rezics/editor/markdown";
import { Paperclip, Smile } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "#/shadcn/button";
import { ImageModal } from "./image/ImageModal";
import type { ImageProvider } from "./image/types";
import { EditorPanel } from "./panel/EditorPanel";
import {
  MentionPanel,
  type UserSearchAdapter,
  useMentionPanel,
} from "./plugins/EditorMention";
import { EmojiPickerOverlay } from "./plugins/EmojiMart";
import "./editor.css";

export const DEFAULT_RESIZE_CONFIG: ResizeConfig = {
  height: 300,
  minHeight: 150,
  maxHeight: 800,
};

export interface RezicsMarkdownEditorProps
  extends Omit<MarkdownEditorProps, "viewRef"> {
  onSubmit?: () => void;
  onCancel?: () => void;
  submitLabel?: string;
  extraRight?: React.ReactNode;
  imageProviders?: ImageProvider[];
  userSearch?: UserSearchAdapter;
  disableResize?: boolean;
  /** Fill the parent container height via CSS flex instead of resize drag. */
  fillHeight?: boolean;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function RezicsMarkdownEditor({
  onSubmit,
  onCancel,
  submitLabel = "Submit",
  extraRight,
  imageProviders,
  userSearch,
  disableResize,
  fillHeight,
  onViewModeChange,
  onChange,
  toolbar: callerToolbar,
  // Handled by this wrapper — don't forward to MarkdownEditor
  emoji: _emoji,
  mention: _mention,
  ...editorProps
}: RezicsMarkdownEditorProps) {
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editorView, setEditorView] = useState<any>(null);
  const viewRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleViewRef = useCallback((view: any) => {
    viewRef.current = view;
    setEditorView(view);
  }, []);

  // ---- Image ----

  const handleInsertImage = useCallback((url: string, alt?: string) => {
    if (viewRef.current) {
      insertImageUrl(viewRef.current, url, alt);
    }
  }, []);

  // ---- Emoji ----

  const handleEmojiPick = useCallback((emoji: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    view.dispatch({
      changes: { from, to, insert: emoji },
      selection: { anchor: from + emoji.length },
    });
    view.focus();
    setEmojiOpen(false);
  }, []);

  const emojiAnchorEl = emojiOpen
    ? (wrapperRef.current?.querySelector(
        '[aria-label="Emoji"]',
      ) as HTMLElement | null)
    : null;

  // ---- Mention ----

  const mention = useMentionPanel(editorView, userSearch);

  const handleEditorChange = useCallback(
    (value: string) => {
      onChange?.(value);
      mention.checkTrigger();
    },
    [onChange, mention.checkTrigger],
  );

  // ---- Toolbar (add emoji button, merge caller overrides) ----

  const toolbar = useMemo((): ToolbarOverride | false | undefined => {
    if (callerToolbar === false) return false;
    return {
      ...callerToolbar,
      extend: (items) => {
        let result = [
          ...items,
          {
            name: "emoji",
            label: "Emoji",
            icon: <Smile size={16} />,
            action: () => setEmojiOpen((prev) => !prev),
          },
        ];
        if (callerToolbar?.extend) {
          result = callerToolbar.extend(result);
        }
        return result;
      },
    };
  }, [callerToolbar]);

  // ---- Layout ----

  const resolvedResize =
    fillHeight || disableResize
      ? undefined
      : (editorProps.resize ?? DEFAULT_RESIZE_CONFIG);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: editor wrapper needs keyboard handling
    <div
      ref={wrapperRef}
      className={fillHeight ? "rezics-editor-fill" : undefined}
      onKeyDown={(e) => {
        // Prevent Enter from propagating to parent forms or dialogs.
        // Modifier+Enter is allowed through so consumers can bind
        // Ctrl+Enter for submit.
        if (e.key === "Enter" && !e.ctrlKey && !e.metaKey) {
          e.stopPropagation();
        }
      }}
    >
      <MarkdownEditor
        {...editorProps}
        className="rezics-editor-wrapper"
        resize={resolvedResize}
        viewRef={handleViewRef}
        onChange={handleEditorChange}
        toolbar={toolbar}
        onViewModeChange={onViewModeChange}
      />
      <EditorPanel
        left={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageModalOpen(true)}
            title="Insert image"
            className="px-2 text-[0.9rem] leading-tight font-normal normal-case"
          >
            <Paperclip className="size-[0.9em]" />
            <span>upload image</span>
          </Button>
        }
        right={
          <>
            {extraRight}
            {onCancel && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCancel}
              >
                Cancel
              </Button>
            )}
            {onSubmit && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={onSubmit}
              >
                {submitLabel}
              </Button>
            )}
          </>
        }
      />
      <ImageModal
        open={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        onInsert={handleInsertImage}
        providers={imageProviders}
      />
      <EmojiPickerOverlay
        open={emojiOpen}
        anchorEl={emojiAnchorEl}
        onPick={handleEmojiPick}
        onClose={() => setEmojiOpen(false)}
      />
      <MentionPanel
        trigger={mention.trigger}
        options={mention.options}
        loading={mention.loading}
        activeIndex={mention.activeIndex}
        setActiveIndex={mention.setActiveIndex}
        onPick={mention.pickMention}
        onClose={mention.closeMention}
      />
    </div>
  );
}
