import Button from "@mui/material/Button";
import type {
  MarkdownEditorProps,
  ResizeConfig,
  ToolbarOverride,
} from "@rezics/editor/editor";
import { MarkdownEditor } from "@rezics/editor/editor";
import { insertImageUrl } from "@rezics/editor/markdown";
import { Paperclip, Smile } from "lucide-react";
import type React from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { ImageModal } from "./image/ImageModal";
import type { ImageProvider } from "./image/types";
import { EditorPanel } from "./panel/EditorPanel";
import { MentionPanel, useMentionPanel } from "./plugin/EditorMention";
import { EmojiPickerOverlay } from "./plugin/EmojiMart";
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
  disableResize?: boolean;
}

export function RezicsMarkdownEditor({
  onSubmit,
  onCancel,
  submitLabel = "Submit",
  extraRight,
  imageProviders,
  disableResize,
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

  const mention = useMentionPanel(editorView);

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

  const resolvedResize = disableResize
    ? undefined
    : (editorProps.resize ?? DEFAULT_RESIZE_CONFIG);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: editor wrapper needs keyboard handling
    <div
      ref={wrapperRef}
      onKeyDown={(e) => {
        // Prevent Enter from propagating to parent forms/dialogs
        // (e.g. MUI Dialog, form submission). Modifier+Enter is allowed
        // through so consumers can bind Ctrl+Enter for submit.
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
      />
      <EditorPanel
        left={
          <Button
            variant="text"
            startIcon={<Paperclip />}
            onClick={() => setImageModalOpen(true)}
            title="Insert image"
            sx={{
              textTransform: "none",
              fontSize: "0.9rem",
              lineHeight: 1,
              px: 1,
              "& .MuiButton-startIcon": {
                "& svg": {
                  height: "0.9em",
                },
              },
            }}
          >
            upload image
          </Button>
        }
        right={
          <>
            {extraRight}
            {onCancel && (
              <Button size="small" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSubmit && (
              <Button size="small" variant="contained" onClick={onSubmit}>
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
