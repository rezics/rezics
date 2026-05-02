import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShelfItemCard } from "./ShelfItemCard";

const meta = {
  title: "Domain/Shelf/ShelfItemCard",
  component: ShelfItemCard,
  args: {
    item: {
      shelfUnitId: "shelf-1",
      kind: "book",
      itemRef: "book-quiet-library",
      sortOrder: 0,
    } as never,
  },
} satisfies Meta<typeof ShelfItemCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: {
    item: {
      shelfUnitId: "shelf-1",
      kind: "review",
      itemRef: "review-with-a-very-long-identifier-string-to-truncate",
      sortOrder: 1,
    } as never,
  },
};

export const Compact: Story = {
  args: {
    item: {
      shelfUnitId: "shelf-1",
      kind: "tag",
      itemRef: "fiction",
      sortOrder: 2,
    } as never,
  },
};
