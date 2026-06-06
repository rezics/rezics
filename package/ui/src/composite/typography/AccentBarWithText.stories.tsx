import type { Meta, StoryObj } from "@storybook/react-vite";

import { AccentBarWithText } from "./AccentBarWithText";

const meta = {
  title: "Composite/Typography/AccentBarWithText",
  component: AccentBarWithText,
  args: { height: 24, text: "推荐阅读" },
} satisfies Meta<typeof AccentBarWithText>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ColorVariants: Story = {
  render: () => (
    <div className="p-4 space-y-3">
      <AccentBarWithText text="默认主色" />
      <AccentBarWithText text="自定义颜色" color="#ec4899" />
    </div>
  ),
};
