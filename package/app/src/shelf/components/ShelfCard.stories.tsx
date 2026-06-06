import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  shelfEmpty,
  shelfFew,
  shelfLongDescription,
  shelfMany,
} from "@/stories/fixtures/shelf";
import { ShelfCard } from "./ShelfCard";

const meta = {
  title: "Domain/Shelf/ShelfCard",
  component: ShelfCard,
  decorators: [withRouter],
  args: {
    shelf: shelfFew,
    className: "max-w-sm",
  },
} satisfies Meta<typeof ShelfCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { shelf: shelfEmpty },
};

export const LongContent: Story = {
  args: { shelf: shelfLongDescription },
};

export const Large: Story = {
  args: { shelf: shelfMany },
};
