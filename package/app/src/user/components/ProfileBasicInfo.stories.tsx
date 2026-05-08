import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { userAlice, userAnonymous, userBen } from "@/stories/fixtures/user";
import { ProfileBasicInfo } from "./ProfileBasicInfo";

const meta = {
  title: "Domain/User/ProfileBasicInfo",
  component: ProfileBasicInfo,
  decorators: [withRouter],
  args: {
    user: userAlice as never,
    isCurrentUser: false,
    unitId: userAlice.userId,
  },
} satisfies Meta<typeof ProfileBasicInfo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { user: userAnonymous as never, unitId: userAnonymous.userId },
};

export const Compact: Story = {
  args: { user: userBen as never, unitId: userBen.userId, isCurrentUser: true },
};
