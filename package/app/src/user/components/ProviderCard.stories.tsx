import type { Meta, StoryObj } from "@storybook/react-vite";

import { ProviderCard } from "./ProviderCard";

const GoogleIcon = () => <span style={{ fontSize: 20 }}>G</span>;

const meta = {
  title: "Domain/User/ProviderCard",
  component: ProviderCard,
  args: {
    providerId: "google" as never,
    name: "Google",
    icon: GoogleIcon,
    connected: false,
    isPrimary: false,
    onConnect: () => {},
  },
} satisfies Meta<typeof ProviderCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { connected: true, isPrimary: true },
};

export const Loading: Story = {
  args: { connecting: true },
};
