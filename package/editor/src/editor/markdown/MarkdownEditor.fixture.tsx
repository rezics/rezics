import { MarkdownEditor } from "../MarkdownEditor";

const sampleMarkdown = `# Hello World

This is a **bold** statement with some *italic* text and ~~strikethrough~~.

## Features

- List item one
- List item two
- List item three

1. Numbered first
2. Numbered second

> A blockquote for emphasis.

\`\`\`js
const x = 42;
console.log(x);
\`\`\`

| Column A | Column B |
|----------|----------|
| Cell 1   | Cell 2   |

[A link](https://example.com) and an ![image](https://via.placeholder.com/100)
`;

const longMarkdown = Array.from(
  { length: 30 },
  (_, i) =>
    `## Section ${i + 1}\n\nParagraph for section ${i + 1}. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n- Item A\n- Item B\n- Item C\n`,
).join("\n");

export default {
  Default: () => <MarkdownEditor value={sampleMarkdown} className="h-screen" />,

  NoPreview: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      className="h-screen"
    />
  ),

  LongContent: () => (
    <MarkdownEditor value={longMarkdown} preview={true} className="h-screen" />
  ),

  EmptyContent: () => (
    <MarkdownEditor value="" preview={false} className="h-screen" />
  ),

  Resizable: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      resize={{ height: 400, minHeight: 200, maxHeight: 800 }}
    />
  ),
};
