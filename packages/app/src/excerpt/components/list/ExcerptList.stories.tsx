import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { excerptList } from "@/stories/fixtures/excerpt";
import { ExcerptList } from "./ExcerptList";

const meta = {
  title: "Domain/Excerpt/ExcerptList",
  component: ExcerptList,
  decorators: [withRouter],
  args: { units: excerptList },
} satisfies Meta<typeof ExcerptList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { units: [] },
};
