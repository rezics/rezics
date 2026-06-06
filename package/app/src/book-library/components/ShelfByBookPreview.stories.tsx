import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { ShelfByBookPreview } from "./ShelfByBookPreview";

const meta = {
  title: "Domain/Book/ShelfByBookPreview",
  component: ShelfByBookPreview,
  decorators: [withRouter],
  args: { bookId: "book-quiet-library", title: "The Quiet Library" },
  parameters: {
    docs: {
      description: {
        component:
          "Carousel of shelves containing the given book. Without a backend / MSW handler the carousel renders empty.",
      },
    },
  },
} satisfies Meta<typeof ShelfByBookPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
