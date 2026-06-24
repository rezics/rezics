import type { Meta, StoryObj } from "@storybook/react-vite";

import { CooldownButton } from "./CooldownButton";

const meta = {
  title: "Composite/Button/CooldownButton",
  component: CooldownButton,
  args: {
    cooldownMs: 5000,
    children: "Send code",
    variant: "default",
  },
} satisfies Meta<typeof CooldownButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Small: Story = {
  args: { cooldownMs: 3000, size: "sm", children: "Resend" },
};

export const Disabled: Story = {
  args: { disabled: true },
};
