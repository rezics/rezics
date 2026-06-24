import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { RemarkPreview } from "./RemarkPreview";

const meta = {
  title: "Domain/Book/RemarkPreview",
  component: RemarkPreview,
  decorators: [withRouter],
  args: { bookId: "book-quiet-library" },
  parameters: {
    docs: {
      description: {
        component:
          "Pulls remarks for a book via `postQueries.byTarget`. Without a backend / MSW handler the preview shows the empty state.",
      },
    },
  },
} satisfies Meta<typeof RemarkPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
