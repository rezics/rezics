import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  excerptCJK,
  excerptLatin,
  excerptLong,
  excerptShort,
} from "@/stories/fixtures/excerpt";
import { ExcerptCard } from "./ExcerptCard";

const meta = {
  title: "Domain/Excerpt/ExcerptCard",
  component: ExcerptCard,
  decorators: [withRouter],
  args: {
    excerpt: excerptShort,
    className: "max-w-2xl",
  },
} satisfies Meta<typeof ExcerptCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: { excerpt: excerptLong },
};

export const LocaleCJK: Story = {
  args: { excerpt: excerptCJK },
};

export const LocaleLatin: Story = {
  args: { excerpt: excerptLatin },
};
