import type { Meta, StoryObj } from "@storybook/react-vite";

import { MarkdownContent } from "./MarkdownContent";

const meta = {
  title: "Composite/Content/MarkdownContent",
  component: MarkdownContent,
} satisfies Meta<typeof MarkdownContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content:
      "# Hello\n\nThis is **markdown** rendered with the rezics renderer.",
  },
};

export const LongContent: Story = {
  args: {
    content: `# A reading journal\n\nReview drafts often start with a hook.\n\n## Why this book\n\n- It surprised me.\n- The structure rewarded re-reading.\n- The author's voice is clear.\n\n## Quotes\n\n> A library is a collection of possible futures.\n\n---\n\nLine breaks, **bold**, and [links](https://example.com) all render through the same renderer used in production reviews.`,
  },
};

export const Empty: Story = {
  args: { content: "" },
};
