import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { reviewList } from "@/stories/fixtures/review";
import { ReviewList } from "./ReviewList";

const meta = {
  title: "Domain/Review/ReviewList",
  component: ReviewList,
  decorators: [withRouter],
  args: { reviews: reviewList },
} satisfies Meta<typeof ReviewList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { reviews: [] },
};

export const Compact: Story = {
  args: { reviews: reviewList.slice(0, 2), spacing: 0.5 },
};
