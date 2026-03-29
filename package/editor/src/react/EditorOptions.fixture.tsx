import { useMemo } from 'react';
import { useFixtureInput, useFixtureSelect } from 'react-cosmos/client';
import { Editor } from './Editor';
import { markdownFull } from '../markdown/index';
import { jsonFull } from '../json/index';
import { createTheme } from '../core/theme';
import type { EditorPlugin } from '../core/types';

const sampleContent: Record<string, string> = {
  markdown: '# Heading\n\nSome **bold** and *italic* text.\n\n- Item 1\n- Item 2\n',
  json: JSON.stringify({ hello: 'world', count: 42 }, null, 2),
  plain: 'Plain text editor with no language plugins.',
};

function getPlugins(mode: string): EditorPlugin[] {
  switch (mode) {
    case 'markdown':
      return markdownFull({ preview: true });
    case 'json':
      return jsonFull();
    default:
      return [];
  }
}

export default function EditorOptionsFixture() {
  const [mode] = useFixtureSelect('Mode', {
    options: ['markdown', 'json', 'plain'],
    defaultValue: 'markdown',
  });

  const [toolbar] = useFixtureSelect('Toolbar', {
    options: ['react', 'none'],
    defaultValue: 'react',
  });

  const [themeVariant] = useFixtureSelect('Theme', {
    options: ['light', 'dark'],
    defaultValue: 'light',
  });

  const [content] = useFixtureInput('Content', sampleContent[mode] ?? '');

  const theme = useMemo(
    () => createTheme({ variant: themeVariant as 'light' | 'dark' }),
    [themeVariant],
  );

  const plugins = useMemo(() => getPlugins(mode), [mode]);

  return (
    <div
      style={{
        height: '100vh',
        background: themeVariant === 'dark' ? '#1e1e1e' : '#ffffff',
      }}
    >
      <Editor
        key={`${mode}-${toolbar}-${themeVariant}`}
        value={content}
        plugins={plugins}
        toolbar={toolbar === 'none' ? false : 'react'}
        theme={theme}
        className="h-full"
      />
    </div>
  );
}
