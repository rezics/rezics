import type { Meta, StoryObj } from "@storybook/react-vite";

import { ArrowForwardIcon } from "./ArrowForwardIcon";

const meta = {
  title: "Composite/Navigation/ArrowForwardIcon",
  component: ArrowForwardIcon,
  args: { size: 24, children: "点击查看更多" },
} satisfies Meta<typeof ArrowForwardIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Sizes: Story = {
  render: () => (
    <div className="p-4 space-y-4">
      <div>
        <ArrowForwardIcon size={16}>小尺寸</ArrowForwardIcon>
      </div>
      <div>
        <ArrowForwardIcon size={24}>中等尺寸</ArrowForwardIcon>
      </div>
      <div>
        <ArrowForwardIcon size={32}>大尺寸</ArrowForwardIcon>
      </div>
    </div>
  ),
};

export const Examples: Story = {
  render: () => (
    <div className="p-4 space-y-4">
      <div>
        <ArrowForwardIcon>查看详情</ArrowForwardIcon>
      </div>
      <div>
        <ArrowForwardIcon>继续阅读</ArrowForwardIcon>
      </div>
      <div>
        <ArrowForwardIcon>了解更多</ArrowForwardIcon>
      </div>
    </div>
  ),
};
