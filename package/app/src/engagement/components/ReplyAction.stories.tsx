import type { Meta, StoryObj } from "@storybook/react-vite";

import { ReplyAction } from "./ReplyAction";

const meta = {
  title: "App/Engagement/ReplyAction",
  component: ReplyAction,
} satisfies Meta<typeof ReplyAction>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SmCountModeZero: Story = {
  render: () => <ReplyAction size="sm" replyCount={0} mode="count" />,
};

export const MdCountMode12Replies: Story = {
  render: () => <ReplyAction size="md" replyCount={12} mode="count" />,
};

export const MdLabelMode: Story = {
  render: () => <ReplyAction size="md" replyCount={4} mode="label" />,
};

export const LgLargeDetailSurface: Story = {
  render: () => <ReplyAction size="lg" replyCount={128} mode="count" />,
};
