import type { Meta, StoryObj } from "@storybook/react-vite";

import type { ToolbarItem } from "../../toolbar/types";
import { MarkdownEditor } from "../MarkdownEditor";

const sampleMarkdown = `# Toolbar Fixture

Some **bold** and *italic* text.

- List item
- Another item

> Blockquote

\`\`\`js
const x = 1;
\`\`\`
`;

const meta = {
  title: "Editor/Markdown/Toolbar",
  component: MarkdownEditor,
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DefaultToolbar: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      className="h-screen"
    />
  ),
};

export const NoToolbar: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      toolbar={false}
      preview={false}
      className="h-screen"
    />
  ),
};

export const CustomIcons: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      toolbar={{
        icons: {
          bold: <span style={{ fontWeight: 700, fontSize: 14 }}>B</span>,
          italic: <span style={{ fontStyle: "italic", fontSize: 14 }}>I</span>,
          heading: <span style={{ fontWeight: 700, fontSize: 12 }}>H₁</span>,
        },
      }}
      className="h-screen"
    />
  ),
};

export const ExtendedToolbar: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      toolbar={{
        extend: (items: ToolbarItem[]) => [
          ...items,
          {
            name: "custom-action",
            label: "Custom Action",
            icon: <span style={{ fontSize: 14 }}>★</span>,
            action: () => alert("Custom toolbar action triggered"),
          },
        ],
      }}
      className="h-screen"
    />
  ),
};

export const WithPreviewButtons: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={true}
      className="h-screen"
    />
  ),
};

export const WithoutPreviewButtons: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      preview={false}
      className="h-screen"
    />
  ),
};
