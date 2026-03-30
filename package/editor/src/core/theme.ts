import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { TagStyle } from '@codemirror/language';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';

export interface ThemeSettings {
  background?: string;
  foreground?: string;
  caret?: string;
  selection?: string;
  lineHighlight?: string;
  gutterBackground?: string;
  gutterForeground?: string;
}

export interface ThemeConfig {
  variant: 'light' | 'dark';
  settings?: ThemeSettings;
  styles?: TagStyle[];
}

export function createTheme(config: ThemeConfig): Extension {
  const { variant, settings = {}, styles = [] } = config;

  const theme = EditorView.theme(
    {
      '&': {
        backgroundColor: settings.background ?? 'transparent',
        color: settings.foreground ?? 'inherit',
      },
      '.cm-content': {
        caretColor: settings.caret ?? settings.foreground ?? 'inherit',
      },
      '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection':
        {
          backgroundColor: settings.selection ?? (variant === 'dark' ? '#264f78' : '#add6ff'),
        },
      '.cm-activeLine': {
        backgroundColor: settings.lineHighlight ?? 'transparent',
      },
      '.cm-gutters': {
        backgroundColor: settings.gutterBackground ?? settings.background ?? 'transparent',
        color: settings.gutterForeground ?? settings.foreground ?? 'inherit',
      },
    },
    { dark: variant === 'dark' },
  );

  const extensions: Extension[] = [theme];

  if (styles.length > 0) {
    extensions.push(syntaxHighlighting(HighlightStyle.define(styles)));
  }

  return extensions;
}
