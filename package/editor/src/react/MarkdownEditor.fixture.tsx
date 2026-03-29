import { Editor } from './Editor';
import { markdown } from '../markdown/core/index';
import { markdownFull } from '../markdown/index';

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
  Basic: () => (
    <Editor value={sampleMarkdown} plugins={[markdown()]} className="h-screen" />
  ),

  Full: () => (
    <Editor
      value={sampleMarkdown}
      plugins={markdownFull({ preview: true })}
      toolbar="react"
      className="h-screen"
    />
  ),

  WithToolbar: () => (
    <Editor
      value={sampleMarkdown}
      plugins={markdownFull()}
      toolbar="react"
      className="h-screen"
    />
  ),
};
