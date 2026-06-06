import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  reviewCJK,
  reviewLatin,
  reviewLong,
  reviewShort,
} from "@/stories/fixtures/review";
import { ReviewCard } from "./ReviewCard";

const meta = {
  title: "Domain/Review/ReviewCard",
  component: ReviewCard,
  decorators: [withRouter],
  args: {
    review: reviewShort,
    className: "max-w-2xl",
  },
} satisfies Meta<typeof ReviewCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongContent: Story = {
  args: { review: reviewLong },
};

export const LocaleCJK: Story = {
  args: { review: reviewCJK },
};

export const LocaleLatin: Story = {
  args: { review: reviewLatin },
};
