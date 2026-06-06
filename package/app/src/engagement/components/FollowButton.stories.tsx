import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { FollowButton } from "./FollowButton";

const meta = {
  title: "Domain/Engagement/FollowButton",
  component: FollowButton,
  decorators: [withRouter],
  args: { userId: "user-alice", initialFollowersCount: 124 },
} satisfies Meta<typeof FollowButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { size: "sm", showFollowersText: false },
};

export const Medium: Story = {
  args: { size: "default", showFollowersText: true },
};

export const Disabled: Story = {
  args: { userId: undefined },
};
