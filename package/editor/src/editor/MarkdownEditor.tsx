import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {EditorContext} from '../react/context';
import {useEditor} from '../react/useEditor';
import {languages} from '@codemirror/language-data';
import {markdown} from '../markdown/core/index';
import {mention} from '../markdown/mention/index';
import {emoji} from '../markdown/emoji/index';
import {resolvePlugins} from '../core/plugin';
import {ReactToolbar} from '../toolbar/react/index';
import {markdownIconMap} from './toolbar-defaults';
import {applyIconDefaults, applyToolbarOverrides} from './toolbar-utils';
import {createNovelRenderer} from '../markdown/preview/index';
import {highlightCode} from '../markdown/preview/highlight';
import {addCopyButtons} from '../markdown/preview/copyButton';
import type {EditorPlugin} from '../core/types';
import type {ToolbarEntry} from '../toolbar/types';
import {ResizableWrapper} from '../react/ResizableWrapper';
import type {MarkdownEditorProps} from './types';
import type {PreviewConfig} from '../markdown/preview/index';
import './MarkdownEditor.css';

export type {MarkdownEditorProps};

type ViewMode = 'write' | 'preview' | 'dual';

function createMarkdownRenderer(config?: PreviewConfig) {
  const highlighter =
    config?.highlight === false
      ? undefined
      : (config?.highlight ?? highlightCode);

  return createNovelRenderer({html: true, highlight: highlighter});
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
}: MarkdownEditorProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveContent, setLiveContent] = useState(value ?? '');
  const previewRef = useRef<HTMLDivElement>(null);
  const containerElRef = useRef<HTMLDivElement>(null);

  const previewConfig = useMemo(
    () =>
      typeof preview === 'object' ? preview : preview ? undefined : undefined,
    [preview],
  );

  // Sync liveContent when the value prop changes externally
  useEffect(() => {
    setLiveContent(value ?? '');
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
    const plugins: EditorPlugin[] = [markdown({codeLanguages: languages})];

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

  // Build toolbar entries with separators between groups + preview extensions
  const toolbarEntries = useMemo((): ToolbarEntry[] => {
    if (toolbar === false) return [];
    const resolved = resolvePlugins(allPlugins).toolbar;
    const withIcons = applyIconDefaults(resolved, markdownIconMap);
    const items = applyToolbarOverrides(withIcons, toolbar);

    // Group items by inserting separators between logical groups
    const textGroup = ['bold', 'italic', 'heading'];
    const blockGroup = ['blockquote', 'unordered-list', 'ordered-list'];
    const insertGroup = ['link', 'image', 'table', 'code-block'];

    const groups = [textGroup, blockGroup, insertGroup];
    const entries: ToolbarEntry[] = [];

    for (const group of groups) {
      const groupItems = group
        .map(name => items.find(item => item.name === name))
        .filter(Boolean) as typeof items;
      if (groupItems.length > 0) {
        if (entries.length > 0) entries.push('|');
        entries.push(...groupItems);
      }
    }

    // Append any remaining items not in predefined groups
    const knownNames = new Set(groups.flat());
    const remaining = items.filter(item => !knownNames.has(item.name));
    if (remaining.length > 0) {
      if (entries.length > 0) entries.push('|');
      entries.push(...remaining);
    }

    // Append preview extension icons (dual-column, fullscreen)
    if (preview) {
      if (entries.length > 0) entries.push('|');
      entries.push(
        {
          name: 'dual-column',
          label: 'Dual column',
          icon: markdownIconMap['dual-column'],
          action: () => setViewMode(m => (m === 'dual' ? 'write' : 'dual')),
          isActive: () => viewMode === 'dual',
        },
        {
          name: 'fullscreen',
          label: 'Fullscreen',
          icon: markdownIconMap.fullscreen,
          action: () => setIsFullscreen(v => !v),
        },
      );
    }

    return entries;
  }, [allPlugins, toolbar, preview, viewMode]);

  const {containerRef, view} = useEditor({
    doc: value,
    plugins: allPlugins,
    keybindings,
    theme,
    onChange: handleChange,
  });

  useEffect(() => {
    viewRef?.(view);
  }, [view, viewRef]);

  // Update preview HTML when in preview or dual-column mode
  useEffect(() => {
    if (viewMode !== 'write' && previewRef.current) {
      previewRef.current.innerHTML = md.render(liveContent);
      addCopyButtons(previewRef.current);
    }
  }, [viewMode, liveContent, md]);

  // Fullscreen toggle with Escape key
  useEffect(() => {
    if (!isFullscreen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  const hasCustomRender = toolbar !== false && toolbar?.render != null;
  const showDefaultToolbar =
    toolbar !== false && !hasCustomRender && toolbarEntries.length > 0;

  const fullscreenStyle: React.CSSProperties = isFullscreen
    ? {
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
      }
    : {display: 'flex', flexDirection: 'column'};

  const useResize = resize && !isFullscreen;

  const editorContent = (
    <div
      ref={containerElRef}
      className={useResize ? undefined : className}
      style={
        useResize
          ? {display: 'flex', flexDirection: 'column' as const, height: '100%'}
          : fullscreenStyle
      }
    >
      {/* Tab bar + toolbar row */}
      <div className="md-editor-header">
        {/* Left: Write / Preview tabs */}
        {preview && (
          <div className="md-editor-tabs">
            <button
              type="button"
              className="md-editor-tab"
              data-active={viewMode === 'write'}
              onClick={() => setViewMode('write')}
            >
              Write
            </button>
            <button
              type="button"
              className="md-editor-tab"
              data-active={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
          </div>
        )}

        {/* Right: toolbar (formatting groups + dual-column / fullscreen) */}
        <div className="md-editor-toolbar-right">
          {hasCustomRender &&
            view &&
            toolbar!.render!(
              toolbarEntries.filter(e => e !== '|') as any,
              view,
            )}
          {showDefaultToolbar && viewMode !== 'preview' && (
            <ReactToolbar items={toolbarEntries} />
          )}
        </div>
      </div>

      {/* Content area */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          display: viewMode === 'dual' ? 'flex' : 'block',
        }}
      >
        {/* Editor — always mounted, hidden in preview-only mode */}
        <div
          ref={containerRef}
          style={{
            display: viewMode === 'preview' ? 'none' : 'block',
            flex: viewMode === 'dual' ? 1 : undefined,
            overflow: viewMode === 'dual' ? 'auto' : undefined,
            borderRight:
              viewMode === 'dual' ? '1px solid #d0d7de' : undefined,
          }}
        />

        {/* Preview — shown in preview and dual modes */}
        {preview && viewMode !== 'write' && (
          <div
            ref={previewRef}
            className="markdown-body md-editor-preview"
            style={{
              flex: viewMode === 'dual' ? 1 : undefined,
              overflow: viewMode === 'dual' ? 'auto' : undefined,
            }}
          />
        )}
      </div>
    </div>
  );

  return (
    <EditorContext.Provider value={view}>
      {useResize ? (
        <ResizableWrapper config={resize} className={className}>
          {editorContent}
        </ResizableWrapper>
      ) : (
        editorContent
      )}
    </EditorContext.Provider>
  );
}
