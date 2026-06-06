import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { bookCardPropsList } from "@/stories/fixtures/book";
import { BookCard } from "./VerticalBookCard";

const sample = bookCardPropsList[0];

const meta = {
  title: "Domain/Book/VerticalBookCard",
  component: BookCard,
  decorators: [withRouter],
  args: {
    title: sample.title,
    author: sample.author,
    coverUrl: sample.coverUrl,
    href: sample.href,
    className: "max-w-32",
  },
} satisfies Meta<typeof BookCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    title:
      "An Astonishingly Long Title That Refuses to Compress, with a Subtitle and Several Subordinate Clauses",
  },
};

export const Empty: Story = {
  args: {
    title: "Untitled draft",
    author: undefined,
    coverUrl: "https://placehold.co/240x360/e5e7eb/6b7280?text=No+cover",
  },
};

export const LocaleCJK: Story = {
  args: {
    title: "靜默圖書館的十二個房間",
    author: "田中美依",
  },
};

export const LocaleLatin: Story = {
  args: {
    title: "The Quiet Library",
    author: "Mei Tanaka",
  },
};
