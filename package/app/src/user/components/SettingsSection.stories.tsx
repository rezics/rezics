import type { Meta, StoryObj } from "@storybook/react-vite";

import { SettingsSection } from "./SettingsSection";

const meta = {
  title: "Domain/User/SettingsSection",
  component: SettingsSection,
  args: {
    title: "Display name",
    description:
      "How your name appears across the platform. Other readers see this on posts, reviews, and shelves.",
    children: (
      <input placeholder="Display name" className="border p-2 w-full" />
    ),
  },
} satisfies Meta<typeof SettingsSection>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: { description: undefined, divider: false },
};
