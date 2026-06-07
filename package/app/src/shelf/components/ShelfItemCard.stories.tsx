import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShelfItemCard } from "./ShelfItemCard";

const meta = {
  title: "Domain/Shelf/ShelfItemCard",
  component: ShelfItemCard,
  args: {
    unit: {
      shelfId: "shelf-1",
      itemType: "unit",
      itemId: "book-quiet-library",
      kind: "book",
      position: "a0",
    },
  },
} satisfies Meta<typeof ShelfItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    unit: {
      shelfId: "shelf-1",
      itemType: "unit",
      itemId: "review-with-a-very-long-identifier-string-to-truncate",
      kind: "review",
      position: "a1",
    },
  },
};

export const Compact: Story = {
  args: {
    unit: {
      shelfId: "shelf-1",
      itemType: "unit",
      itemId: "fiction",
      kind: "tag",
      position: "a2",
    },
  },
};
