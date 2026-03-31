import { useMemo } from 'react';
import { useFixtureInput, useFixtureSelect } from 'react-cosmos/client';
import { MarkdownEditor } from './MarkdownEditor';
import { JsonEditor } from './JsonEditor';
import { CodeEditor } from './CodeEditor';
import { createTheme } from '../core/theme';

const sampleContent: Record<string, string> = {
  markdown:
    '# Heading\n\nSome **bold** and *italic* text.\n\n- Item 1\n- Item 2\n',
  json: JSON.stringify({ hello: 'world', count: 42 }, null, 2),
  plain: 'Plain text editor with no language plugins.',
};

export default function EditorOptionsFixture() {
  const [mode] = useFixtureSelect('Mode', {
    options: ['markdown', 'json', 'plain'],
    defaultValue: 'markdown',
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

  const editor = useMemo(() => {
    const props = { value: content, theme, className: 'h-full' };
    switch (mode) {
      case 'markdown':
        return <MarkdownEditor key={themeVariant} preview={true} {...props} />;
      case 'json':
        return <JsonEditor key={themeVariant} {...props} />;
      default:
        return <CodeEditor key={themeVariant} {...props} />;
    }
  }, [mode, content, theme, themeVariant]);

  return (
    <div
      style={{
        height: '100vh',
        background: themeVariant === 'dark' ? '#1e1e1e' : '#ffffff',
      }}
    >
      {editor}
    </div>
  );
}
