import { MarkdownEditor } from './MarkdownEditor';

const sampleMarkdown = `# Hello World

This is a **bold** statement with some *italic* text.

## Features

- List item one
- List item two
- List item three

> A blockquote for emphasis.

\`\`\`js
const x = 42;
\`\`\`

[A link](https://example.com)
`;

export default {
  Default: () => (
    <MarkdownEditor value={sampleMarkdown} className="h-screen" />
  ),

  WithPreview: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={true}
      className="h-screen"
    />
  ),

  NoToolbar: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      toolbar={false}
      className="h-screen"
    />
  ),
};
