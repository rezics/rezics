import { showPanel, EditorView, type Panel } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import MarkdownIt from 'markdown-it';
import { preserveFormattingPlugin } from './preserveFormatting';
import { highlightCode } from './highlight';

export interface PreviewConfig {
  mode?: 'side-by-side' | 'toggle';
  /** Custom code highlighter. Set to `false` to disable. Defaults to built-in highlight.js. */
  highlight?: ((code: string, lang: string) => string) | false;
}

function createPreviewPanel(md: MarkdownIt, mode: string) {
  return (view: EditorView): Panel => {
    const dom = document.createElement('div');
    dom.className = 'cm-preview-panel markdown-body';
    if (mode === 'side-by-side') {
      dom.classList.add('cm-preview-side-by-side');
    }

    let timeout: ReturnType<typeof setTimeout> | null = null;

    function renderPreview() {
      dom.innerHTML = md.render(view.state.doc.toString());
    }

    renderPreview();

    return {
      dom,
      top: false,
      update(update) {
        if (update.docChanged) {
          if (timeout) clearTimeout(timeout);
          timeout = setTimeout(renderPreview, 150);
        }
      },
      destroy() {
        if (timeout) clearTimeout(timeout);
      },
    };
  };
}

export function previewExtension(config?: PreviewConfig): Extension {
  const mode = config?.mode ?? 'side-by-side';

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

  return [
    showPanel.of(createPreviewPanel(md, mode)),
    EditorView.baseTheme({
      '.cm-preview-panel': {
        padding: '8px 16px',
        borderTop: '1px solid #ddd',
        overflow: 'auto',
        maxHeight: '50vh',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        lineHeight: '1.6',
      },
      '.cm-preview-side-by-side': {
        borderTop: 'none',
        borderLeft: '1px solid #ddd',
      },
      // Fallback styles (overridden when github-markdown-css is loaded)
      '.cm-preview-panel h1': {
        fontSize: '2em',
        fontWeight: '600',
        borderBottom: '1px solid #d0d7de',
        paddingBottom: '.3em',
        marginTop: '24px',
        marginBottom: '16px',
      },
      '.cm-preview-panel h2': {
        fontSize: '1.5em',
        fontWeight: '600',
        borderBottom: '1px solid #d0d7de',
        paddingBottom: '.3em',
        marginTop: '24px',
        marginBottom: '16px',
      },
      '.cm-preview-panel h3': {
        fontSize: '1.25em',
        fontWeight: '600',
        marginTop: '24px',
        marginBottom: '16px',
      },
      '.cm-preview-panel blockquote': {
        borderLeft: '4px solid #d0d7de',
        margin: '0 0 16px',
        padding: '0 1em',
        color: '#656d76',
      },
      '.cm-preview-panel pre': {
        backgroundColor: '#f6f8fa',
        borderRadius: '6px',
        padding: '16px',
        overflow: 'auto',
        marginBottom: '16px',
        lineHeight: '1.45',
      },
      '.cm-preview-panel code': {
        fontFamily: 'ui-monospace, monospace',
        fontSize: '85%',
      },
      '.cm-preview-panel :not(pre) > code': {
        backgroundColor: 'rgba(175, 184, 193, 0.2)',
        borderRadius: '6px',
        padding: '0.2em 0.4em',
      },
      '.cm-preview-panel table': {
        borderCollapse: 'collapse',
        width: '100%',
        marginBottom: '16px',
      },
      '.cm-preview-panel th, .cm-preview-panel td': {
        border: '1px solid #d0d7de',
        padding: '6px 13px',
      },
      '.cm-preview-panel th': {
        fontWeight: '600',
        backgroundColor: '#f6f8fa',
      },
      '.cm-preview-panel hr': {
        border: 'none',
        borderTop: '1px solid #d0d7de',
        margin: '24px 0',
      },
      '.cm-preview-panel img': {
        maxWidth: '100%',
      },
      // highlight.js token colors (GitHub-inspired)
      '.cm-preview-panel .hljs-keyword': { color: '#cf222e' },
      '.cm-preview-panel .hljs-string': { color: '#0a3069' },
      '.cm-preview-panel .hljs-comment': { color: '#6e7781', fontStyle: 'italic' },
      '.cm-preview-panel .hljs-number': { color: '#0550ae' },
      '.cm-preview-panel .hljs-literal': { color: '#0550ae' },
      '.cm-preview-panel .hljs-built_in': { color: '#953800' },
      '.cm-preview-panel .hljs-type': { color: '#953800' },
      '.cm-preview-panel .hljs-function': { color: '#8250df' },
      '.cm-preview-panel .hljs-title': { color: '#8250df' },
      '.cm-preview-panel .hljs-attr': { color: '#0550ae' },
      '.cm-preview-panel .hljs-attribute': { color: '#0550ae' },
      '.cm-preview-panel .hljs-selector-class': { color: '#0550ae' },
      '.cm-preview-panel .hljs-selector-tag': { color: '#116329' },
      '.cm-preview-panel .hljs-selector-id': { color: '#0550ae' },
      '.cm-preview-panel .hljs-variable': { color: '#953800' },
      '.cm-preview-panel .hljs-meta': { color: '#6e7781' },
      '.cm-preview-panel .hljs-regexp': { color: '#0a3069' },
      '.cm-preview-panel .hljs-tag': { color: '#116329' },
      '.cm-preview-panel .hljs-name': { color: '#116329' },
    }),
  ];
}
