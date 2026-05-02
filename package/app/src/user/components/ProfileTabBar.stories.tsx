import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { ProfileTabBar } from "./ProfileTabBar";

const meta = {
  title: "Domain/User/ProfileTabBar",
  component: ProfileTabBar,
  decorators: [withRouter],
  args: { unitId: "user-alice" },
} satisfies Meta<typeof ProfileTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
