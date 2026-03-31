import { useMemo, useState, useRef, useEffect } from 'react';
import MarkdownIt from 'markdown-it';
import { EditorContext } from '../react/context';
import { useEditor } from '../react/useEditor';
import { markdown } from '../markdown/core/index';
import { mention } from '../markdown/mention/index';
import { emoji } from '../markdown/emoji/index';
import { resolvePlugins } from '../core/plugin';
import { ReactToolbar } from '../toolbar/react/index';
import { markdownIconMap } from './toolbar-defaults';
import { applyIconDefaults, applyToolbarOverrides } from './toolbar-utils';
import { preserveFormattingPlugin } from '../markdown/preview/index';
import { highlightCode } from '../markdown/preview/highlight';
import type { EditorPlugin } from '../core/types';
import type { MarkdownEditorProps } from './types';
import type { PreviewConfig } from '../markdown/preview/index';

export type { MarkdownEditorProps };

function createMarkdownRenderer(config?: PreviewConfig) {
  const highlighter =
    config?.highlight === false
      ? undefined
      : config?.highlight ?? highlightCode;

  const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
    highlight: highlighter,
  });
  preserveFormattingPlugin(md);
  return md;
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
}: MarkdownEditorProps) {
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const previewRef = useRef<HTMLDivElement>(null);

  const previewConfig = useMemo(
    () =>
      typeof preview === 'object'
        ? preview
        : preview
          ? undefined
          : undefined,
    [preview],
  );

  const md = useMemo(() => createMarkdownRenderer(previewConfig), [previewConfig]);

  // Build plugins WITHOUT the panel-based preview (we handle preview via tabs)
  const allPlugins = useMemo(() => {
    const plugins: EditorPlugin[] = [markdown()];

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

  const toolbarItems = useMemo(() => {
    if (toolbar === false) return [];
    const resolved = resolvePlugins(allPlugins).toolbar;
    const withIcons = applyIconDefaults(resolved, markdownIconMap);
    return applyToolbarOverrides(withIcons, toolbar);
  }, [allPlugins, toolbar]);

  const { containerRef, view } = useEditor({
    doc: value,
    plugins: allPlugins,
    keybindings,
    theme,
    onChange,
  });

  // Update preview HTML when switching to preview tab or when value changes
  useEffect(() => {
    if (activeTab === 'preview' && previewRef.current) {
      previewRef.current.innerHTML = md.render(value ?? '');
    }
  }, [activeTab, value, md]);

  const hasCustomRender = toolbar !== false && toolbar?.render != null;
  const showDefaultToolbar =
    toolbar !== false && !hasCustomRender && toolbarItems.length > 0;

  return (
    <EditorContext.Provider value={view}>
      <div className={className} style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Tab bar + toolbar row */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #d0d7de', padding: '0 8px' }}>
          {preview && (
            <div style={{ display: 'flex', gap: 0, marginRight: 8 }}>
              <button
                type="button"
                onClick={() => setActiveTab('write')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderBottom: activeTab === 'write' ? '2px solid #0969da' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === 'write' ? 600 : 400,
                  color: activeTab === 'write' ? '#24292f' : '#656d76',
                }}
              >
                Write
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  borderBottom: activeTab === 'preview' ? '2px solid #0969da' : '2px solid transparent',
                  background: 'none',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: activeTab === 'preview' ? 600 : 400,
                  color: activeTab === 'preview' ? '#24292f' : '#656d76',
                }}
              >
                Preview
              </button>
            </div>
          )}
          {hasCustomRender && view && toolbar!.render!(toolbarItems, view)}
          {showDefaultToolbar && activeTab === 'write' && (
            <ReactToolbar items={toolbarItems} />
          )}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div ref={containerRef} style={{ display: activeTab === 'write' ? 'block' : 'none' }} />
          {preview && activeTab === 'preview' && (
            <div
              ref={previewRef}
              className="markdown-body"
              style={{
                padding: '16px',
                fontFamily: 'sans-serif',
                fontSize: '14px',
                lineHeight: '1.6',
              }}
            />
          )}
        </div>
      </div>
    </EditorContext.Provider>
  );
}
