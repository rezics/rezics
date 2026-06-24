import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { BookReviews } from "./BookReviewsPreview";

const meta = {
  title: "Domain/Book/BookReviewsPreview",
  component: BookReviews,
  decorators: [withRouter],
  args: { bookId: "book-quiet-library", title: "The Quiet Library" },
  parameters: {
    docs: {
      description: {
        component:
          "Reads from `postQueries.byTarget` with `kind=REVIEW`. Without a backend / MSW handler the preview falls back to an empty list under the heading.",
      },
    },
  },
} satisfies Meta<typeof BookReviews>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
