import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { bookFew } from "@/stories/fixtures/book";
import { MetadataPanel } from "./MetadataPanel";

const meta = {
  title: "Domain/Book/MetadataPanel",
  component: MetadataPanel,
  decorators: [withRouter],
  args: {
    bookInfo: {
      ...bookFew,
      isbn13: "9780000000001",
      textLength: 86_400,
      pageCount: 320,
      formatKey: "paperback",
    } as never,
  },
} satisfies Meta<typeof MetadataPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { variant: "inline" },
};
