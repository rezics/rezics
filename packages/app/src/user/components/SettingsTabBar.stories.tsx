import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { SettingsTabBar } from "./SettingsTabBar";

const meta = {
  title: "Domain/User/SettingsTabBar",
  component: SettingsTabBar,
  decorators: [withRouter],
} satisfies Meta<typeof SettingsTabBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
