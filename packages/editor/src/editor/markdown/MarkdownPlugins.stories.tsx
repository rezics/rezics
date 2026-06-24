import type { Meta, StoryObj } from "@storybook/react-vite";

import { MarkdownEditor } from "../MarkdownEditor";
import { stubEmojiConfig, stubMentionConfig } from "./_stubs";

const sampleMarkdown = `# Plugin Demo

Type @ to trigger mentions. Try @Alice or @Bob.

This editor tests plugin combinations.

- **Mention**: autocomplete on @ trigger
- **Emoji**: emoji picker integration
- **Preview**: rendered markdown output
`;

const meta = {
  title: "Editor/Markdown/Plugins",
  component: MarkdownEditor,
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithMention: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      mention={stubMentionConfig}
      preview={false}
      className="h-screen"
    />
  ),
};

export const WithEmoji: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      emoji={stubEmojiConfig}
      preview={false}
      className="h-screen"
    />
  ),
};

export const AllPlugins: Story = {
  render: () => (
    <MarkdownEditor
      value={sampleMarkdown}
      mention={stubMentionConfig}
      emoji={stubEmojiConfig}
      preview={true}
      className="h-screen"
    />
  ),
};
