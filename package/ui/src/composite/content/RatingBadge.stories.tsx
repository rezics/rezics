import type { Meta, StoryObj } from "@storybook/react-vite";

import { RatingBadge } from "./RatingBadge";

const meta = {
  title: "Composite/Content/RatingBadge",
  component: RatingBadge,
  args: { rating: "GENERAL" },
} satisfies Meta<typeof RatingBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { rating: "R_15", size: "sm" },
};

export const Medium: Story = {
  args: { rating: "R_18", size: "md" },
};

export const Large: Story = {
  args: { rating: "R_18G", size: "md", variant: "filled" },
};
