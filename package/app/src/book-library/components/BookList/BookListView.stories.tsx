import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { bookFew, bookMany } from "@/stories/fixtures/book";
import { BookListView } from "./BookListView";

const meta = {
  title: "Domain/Book/BookListView",
  component: BookListView,
  decorators: [withRouter],
  args: { books: [bookFew, ...bookMany.slice(0, 3)] },
} satisfies Meta<typeof BookListView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { books: [] },
};

export const Large: Story = {
  args: { books: bookMany },
};
