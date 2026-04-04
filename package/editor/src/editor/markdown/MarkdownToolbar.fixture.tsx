import {MarkdownEditor} from '../MarkdownEditor';
import type {ToolbarItem} from '../../toolbar/types';

const sampleMarkdown = `# Toolbar Fixture

Some **bold** and *italic* text.

- List item
- Another item

> Blockquote

\`\`\`js
const x = 1;
\`\`\`
`;

export default {
  DefaultToolbar: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      className="h-screen"
    />
  ),

  NoToolbar: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      toolbar={false}
      preview={false}
      className="h-screen"
    />
  ),

  CustomIcons: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      toolbar={{
        icons: {
          bold: <span style={{fontWeight: 700, fontSize: 14}}>B</span>,
          italic: <span style={{fontStyle: 'italic', fontSize: 14}}>I</span>,
          heading: <span style={{fontWeight: 700, fontSize: 12}}>H₁</span>,
        },
      }}
      className="h-screen"
    />
  ),

  ExtendedToolbar: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      toolbar={{
        extend: (items: ToolbarItem[]) => [
          ...items,
          {
            name: 'custom-action',
            label: 'Custom Action',
            icon: <span style={{fontSize: 14}}>★</span>,
            action: () => alert('Custom toolbar action triggered'),
          },
        ],
      }}
      className="h-screen"
    />
  ),

  WithPreviewButtons: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={true}
      className="h-screen"
    />
  ),

  WithoutPreviewButtons: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      className="h-screen"
    />
  ),
};
