import { languages } from "@codemirror/language-data";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fixedHeightEditor } from "../core/fixedHeight";
import { resolvePlugins } from "../core/plugin";
import type { EditorPlugin } from "../core/types";
import { markdown } from "../markdown/core/index";
import { emoji } from "../markdown/emoji/index";
import { mention } from "../markdown/mention/index";
import { addCopyButtons } from "../markdown/preview/copyButton";
import { highlightCode } from "../markdown/preview/highlight";
import type { PreviewConfig } from "../markdown/preview/index";
import { createRezicsRenderer } from "../markdown/preview/index";
import { EditorContext } from "../react/context";
import { ResizableWrapper } from "../react/ResizableWrapper";
import { useEditor } from "../react/useEditor";
import { useScrollSync } from "../react/useScrollSync";
import { ReactToolbar } from "../toolbar/react/index";
import type { ToolbarEntry } from "../toolbar/types";
import { markdownIconMap } from "./toolbar-defaults";
import { applyIconDefaults, applyToolbarOverrides } from "./toolbar-utils";
import type { MarkdownEditorProps } from "./types";
import "./MarkdownEditor.css";

export type { MarkdownEditorProps };

import type { ViewMode } from "./types";

function createMarkdownRenderer(config?: PreviewConfig) {
  const highlighter =
    config?.highlight === false
      ? undefined
      : (config?.highlight ?? highlightCode);

  return createRezicsRenderer({ html: true, highlight: highlighter });
}

export function MarkdownEditor({
  value,
  onChange,
  theme,
  className,
  keybindings,
  plugins: extraPlugins,
  preview = true,
  mention: mentionConfig,
  emoji: emojiConfig,
  toolbar,
  resize,
  viewRef,
  onViewModeChange,
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("write");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveContent, setLiveContent] = useState(value ?? "");
  const previewRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  const previewConfig = useMemo(
    () => (typeof preview === "object" ? preview : undefined),
    [preview],
  );

  useEffect(() => {
    onViewModeChange?.(viewMode);
  }, [viewMode, onViewModeChange]);

  useEffect(() => {
    setLiveContent(value ?? "");
  }, [value]);

  const handleChange = useCallback(
    (newValue: string) => {
      setLiveContent(newValue);
      onChange?.(newValue);
    },
    [onChange],
  );

  const md = useMemo(
    () => createMarkdownRenderer(previewConfig),
    [previewConfig],
  );

  const allPlugins = useMemo(() => {
    const plugins: EditorPlugin[] = [markdown({ codeLanguages: languages })];

    if (mentionConfig) {
      plugins.push(mention(mentionConfig));
    }
    if (emojiConfig) {
      plugins.push(emoji(emojiConfig));
    }
    if (extraPlugins) {
      plugins.push(...extraPlugins);
    }

    return plugins;
  }, [mentionConfig, emojiConfig, extraPlugins]);

  const toolbarEntries = useMemo((): ToolbarEntry[] => {
    if (toolbar === false) return [];

    const resolved = resolvePlugins(allPlugins).toolbar;
    const withIcons = applyIconDefaults(resolved, markdownIconMap);
    const items = applyToolbarOverrides(withIcons, toolbar);

    const textGroup = ["bold", "italic", "heading"];
    const blockGroup = ["blockquote", "unordered-list", "ordered-list"];
    const insertGroup = ["link", "image", "table", "code-block"];
    const groups = [textGroup, blockGroup, insertGroup];

    const entries: ToolbarEntry[] = [];

    for (const group of groups) {
      const groupItems = group
        .map((name) => items.find((item) => item.name === name))
        .filter(Boolean) as typeof items;

      if (groupItems.length === 0) continue;
      if (entries.length > 0) entries.push("|");
      entries.push(...groupItems);
    }

    const knownNames = new Set(groups.flat());
    const remaining = items.filter((item) => !knownNames.has(item.name));

    if (remaining.length > 0) {
      if (entries.length > 0) entries.push("|");
      entries.push(...remaining);
    }

    if (preview) {
      if (entries.length > 0) entries.push("|");
      entries.push(
        {
          name: "dual-column",
          label: "Dual column",
          icon: markdownIconMap["dual-column"],
          action: () =>
            setViewMode((mode) => (mode === "dual" ? "write" : "dual")),
          isActive: () => viewMode === "dual",
        },
        {
          name: "fullscreen",
          label: "Fullscreen",
          icon: markdownIconMap.fullscreen,
          action: () => setIsFullscreen((value) => !value),
        },
      );
    }

    return entries;
  }, [allPlugins, toolbar, preview, viewMode]);

  const editorExtensions = useMemo(
    () => (resize ? [fixedHeightEditor] : undefined),
    [resize],
  );

  const { containerRef, view } = useEditor({
    doc: value,
    plugins: allPlugins,
    keybindings,
    theme,
    extraExtensions: editorExtensions,
    onChange: handleChange,
  });

  useEffect(() => {
    viewRef?.(view);
  }, [view, viewRef]);

  useScrollSync(view, previewRef, viewMode);

  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;

    const observer = new ResizeObserver(([entry]) => {
      setHeaderHeight(entry.contentRect.height);
    });

    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (viewMode === "write" || !previewRef.current) return;

    previewRef.current.innerHTML = md.render(liveContent);
    addCopyButtons(previewRef.current);

    const el = previewRef.current;
    const handler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLAnchorElement>(
        'a[data-link-kind="external"]',
      );
      if (!target) return;
      e.preventDefault();
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, [viewMode, liveContent, md]);

  useEffect(() => {
    if (!isFullscreen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  const hasCustomRender = toolbar !== false && toolbar?.render != null;
  const showDefaultToolbar =
    toolbar !== false && !hasCustomRender && toolbarEntries.length > 0;

  const useResize = Boolean(resize) && !isFullscreen;
  const isDual = viewMode === "dual";
  const showEditorPane = viewMode !== "preview";
  const showPreviewPane = Boolean(preview) && viewMode !== "write";

  const adjustedResize = useMemo(() => {
    if (!resize || !headerHeight) return resize;

    return {
      ...resize,
      minHeight: (resize.minHeight ?? 100) + headerHeight,
    };
  }, [resize, headerHeight]);

  const containerStyle: React.CSSProperties = useResize
    ? { display: "flex", flexDirection: "column", height: "100%" }
    : isFullscreen
      ? {
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          background: "#fff",
          display: "flex",
          flexDirection: "column",
        }
      : { display: "flex", flexDirection: "column" };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    display: "flex",
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
  };

  const editorPaneStyle: React.CSSProperties = {
    display: showEditorPane ? "block" : "none",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: "hidden",
    borderRight: isDual
      ? "1px solid var(--editor-border-color, #d0d7de)"
      : undefined,
  };

  const previewPaneStyle: React.CSSProperties = {
    display: showPreviewPane ? "block" : "none",
    flex: 1,
    minHeight: 0,
    minWidth: 0,
    overflow: "auto",
  };

  const rootClasses = [
    "md-editor-root",
    useResize && "md-editor-root--resize",
    !useResize && className,
  ]
    .filter(Boolean)
    .join(" ");

  const editorContent = (
    <div className={rootClasses} style={containerStyle}>
      <div ref={headerRef} className="md-editor-header">
        {preview && (
          <div className="md-editor-tabs">
            <button
              type="button"
              className="md-editor-tab"
              data-tab="write"
              data-active={viewMode === "write"}
              onClick={() => setViewMode("write")}
            >
              Write
            </button>
            <button
              type="button"
              className="md-editor-tab"
              data-tab="preview"
              data-active={viewMode === "preview"}
              onClick={() => setViewMode("preview")}
            >
              Preview
            </button>
          </div>
        )}

        <div className="md-editor-toolbar-right">
          {hasCustomRender &&
            view &&
            toolbar!.render!(
              toolbarEntries.filter((entry) => entry !== "|") as any,
              view,
            )}
          {showDefaultToolbar && viewMode !== "preview" && (
            <ReactToolbar items={toolbarEntries} />
          )}
        </div>
      </div>

      <div style={contentStyle}>
        {/* Keep the mount node as a block flex item.
            Making this node itself a flex container can cause .cm-editor
            to size to its intrinsic width instead of filling the pane. */}
        <div ref={containerRef} style={editorPaneStyle} />

        {preview && (
          <div
            ref={previewRef}
            className="markdown-body md-editor-preview"
            style={previewPaneStyle}
          />
        )}
      </div>
    </div>
  );

  return (
    <EditorContext.Provider value={view}>
      {useResize && adjustedResize ? (
        <ResizableWrapper config={adjustedResize} className={className}>
          {editorContent}
        </ResizableWrapper>
      ) : (
        editorContent
      )}
    </EditorContext.Provider>
  );
}
