import type { Meta, StoryObj } from "@storybook/react-vite";
import { markdownContentDoc } from "@rezics/contract";

import { PostBodyMarkdown } from "./PostBodyMarkdown";

const meta = {
  title: "Domain/Post/PostBodyMarkdown",
  component: PostBodyMarkdown,
  args: {
    content: markdownContentDoc(
      "A short note. *Italics* and **bold** render through the markdown pipeline.",
    ),
  },
} satisfies Meta<typeof PostBodyMarkdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    content: markdownContentDoc(
      Array.from(
        { length: 12 },
        (_, i) =>
          `Paragraph ${i + 1}: a long body that should be clampable and expandable on demand.`,
      ).join("\n\n"),
    ),
    clamp: { maxLines: 3 },
  },
};

export const Empty: Story = {
  args: { content: markdownContentDoc("") },
};
