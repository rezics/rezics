import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { shelfList } from "@/stories/fixtures/shelf";
import { ShelfList } from "./ShelfList";

const meta = {
  title: "Domain/Shelf/ShelfList",
  component: ShelfList,
  decorators: [withRouter],
  args: {
    shelves: shelfList,
  },
} satisfies Meta<typeof ShelfList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { shelves: [] },
};
