import type { Meta, StoryObj } from "@storybook/react-vite";

import { withRouter } from "@/stories/decorators/withRouter";
import { SettingsSidebar } from "./SettingsSidebar";

const meta = {
  title: "Domain/User/SettingsSidebar",
  component: SettingsSidebar,
  decorators: [withRouter],
} satisfies Meta<typeof SettingsSidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
