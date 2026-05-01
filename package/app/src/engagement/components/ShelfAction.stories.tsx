import type { Meta, StoryObj } from "@storybook/react-vite";

import { ShelfAction } from "./ShelfAction";

const meta = {
  title: "App/Engagement/ShelfAction",
  component: ShelfAction,
} satisfies Meta<typeof ShelfAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MdDefault: Story = {
  render: () => (
    <ShelfAction size="md" targetUnitId="fixture-shelf-target-1" />
  ),
};

export const SmCompact: Story = {
  render: () => (
    <ShelfAction size="sm" targetUnitId="fixture-shelf-target-2" />
  ),
};

export const MdReviewTarget: Story = {
  render: () => (
    <ShelfAction size="md" targetUnitId="fixture-shelf-target-3" isReview />
  ),
};
