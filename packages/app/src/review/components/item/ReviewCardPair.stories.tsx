import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import {
  reviewCJK,
  reviewLatin,
  reviewLong,
  reviewShort,
} from "@/stories/fixtures/review";
import { ReviewCardPair } from "./ReviewCardPair";

const meta = {
  title: "Domain/Review/ReviewCardPair",
  component: ReviewCardPair,
  decorators: [withRouter],
  args: {
    review1: reviewShort,
    review2: reviewLong,
  },
} satisfies Meta<typeof ReviewCardPair>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LocaleCJK: Story = {
  args: { review1: reviewCJK, review2: reviewLatin },
};
