import type {
  MarkdownEditorProps,
  ResizeConfig,
  ToolbarOverride,
  ViewMode,
} from "@rezics/editor/editor";
import { MarkdownEditor } from "@rezics/editor/editor";
import { insertImageUrl } from "@rezics/editor/markdown";
import { useTranslation } from "@rezics/i18n/react";
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
  submitDisabled?: boolean;
  extraRight?: React.ReactNode;
  imageProviders?: ImageProvider[];
  userSearch?: UserSearchAdapter;
  disableResize?: boolean;
  /**
   * Fill the parent container height via CSS flex instead of resize drag.
   * 通过 CSS flex 填满父容器高度，而非使用拖拽调整尺寸。
   */
  fillHeight?: boolean;
  onViewModeChange?: (mode: ViewMode) => void;
}

export function RezicsMarkdownEditor({
  onSubmit,
  onCancel,
  submitLabel = "Submit",
  submitDisabled,
  extraRight,
  imageProviders,
  userSearch,
  disableResize,
  fillHeight,
  onViewModeChange,
  onChange,
  toolbar: callerToolbar,
  // Handled by this wrapper — don't forward to MarkdownEditor
  // 由本包装组件处理——不向下转发给 MarkdownEditor
  emoji: _emoji,
  mention: _mention,
  ...editorProps
}: RezicsMarkdownEditorProps) {
  const { t } = useTranslation(["editor", "common"]);
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
  // ---- 图片 ----

  const handleInsertImage = useCallback((url: string, alt?: string) => {
    if (viewRef.current) {
      insertImageUrl(viewRef.current, url, alt);
    }
  }, []);

  // ---- Emoji ----
  // ---- 表情 ----

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
  // ---- 提及 ----

  const mention = useMentionPanel(editorView, userSearch);

  const handleEditorChange = useCallback(
    (value: string) => {
      onChange?.(value);
      mention.checkTrigger();
    },
    [onChange, mention.checkTrigger],
  );

  // ---- Toolbar (add emoji button, merge caller overrides) ----
  // ---- 工具栏（添加表情按钮，合并调用方覆盖项） ----

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
  // ---- 布局 ----

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
        // 阻止 Enter 向上冒泡到父级表单或对话框。
        // 放行 Modifier+Enter，以便使用方可绑定 Ctrl+Enter 用于提交。
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
        labels={{
          write: t("editor:write"),
          preview: t("editor:preview"),
        }}
        onViewModeChange={onViewModeChange}
      />
      <EditorPanel
        left={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setImageModalOpen(true)}
            title={t("editor:upload_image")}
            className="px-2 text-[0.9rem] leading-tight font-normal normal-case"
          >
            <Paperclip className="size-[0.9em]" />
            <span>{t("editor:upload_image")}</span>
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
                {t("common:cancel")}
              </Button>
            )}
            {onSubmit && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={onSubmit}
                disabled={submitDisabled}
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
