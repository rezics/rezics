import { showPanel, EditorView, type Panel } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import MarkdownIt from 'markdown-it';
import { preserveFormattingPlugin } from './preserveFormatting';

export interface PreviewConfig {
  mode?: 'side-by-side' | 'toggle';
}

function createPreviewPanel(md: MarkdownIt, mode: string) {
  return (view: EditorView): Panel => {
    const dom = document.createElement('div');
    dom.className = 'cm-preview-panel';
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

  const md = new MarkdownIt({ html: true, linkify: true, typographer: true });
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
    }),
  ];
}
