import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { bookCardPropsList } from "@/stories/fixtures/book";
import { HorizontalBookCard } from "./HorizontalBookCard";

const sample = bookCardPropsList[0];

const meta = {
  title: "Domain/Book/HorizontalBookCard",
  component: HorizontalBookCard,
  decorators: [withRouter],
  args: {
    title: sample.title,
    author: sample.author,
    description: sample.description,
    coverUrl: sample.coverUrl,
    href: sample.href,
    className: "max-w-md",
  },
} satisfies Meta<typeof HorizontalBookCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    title:
      "An Astonishingly Long Title That Refuses to Compress, with a Subtitle and Several Subordinate Clauses",
    description:
      "Long-title books verify that horizontal cards truncate to one line without breaking the cover/text grid.",
  },
};

export const Empty: Story = {
  args: {
    title: "Untitled draft",
    author: undefined,
    description: undefined,
    coverUrl: "https://placehold.co/120x180/e5e7eb/6b7280?text=No+cover",
  },
};

export const LocaleCJK: Story = {
  args: {
    title: "靜默圖書館的十二個房間",
    author: "田中美依",
    description: "從東京到布宜諾斯艾利斯，敘述者走過十二座城市的圖書館。",
  },
};

export const LocaleLatin: Story = {
  args: {
    title: "The Quiet Library",
    author: "Mei Tanaka",
    description:
      "Across twelve essays, the narrator walks through public libraries.",
  },
};
