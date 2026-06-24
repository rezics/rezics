import type { Meta, StoryObj } from "@storybook/react-vite";
import { Globe } from "lucide-react";

import { AuthProviderButton } from "./AuthProviderButton";

const meta = {
  title: "Composite/Auth/AuthProviderButton",
  component: AuthProviderButton,
  args: {
    label: "Continue with Google",
    icon: <Globe className="h-4 w-4" />,
    onClick: () => undefined,
  },
} satisfies Meta<typeof AuthProviderButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { compact: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const Disabled: Story = {
  args: { disabled: true },
};
