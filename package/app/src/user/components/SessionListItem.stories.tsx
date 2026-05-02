import type { Meta, StoryObj } from "@storybook/react-vite";

import { SessionListItem } from "./SessionListItem";

const session = {
  id: "session-1",
  token: "tok_abc",
  userId: "user-alice",
  expiresAt: "2025-01-01T00:00:00.000Z",
  userAgent:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/127.0.0.0 Safari/537.36",
  ipAddress: "192.0.2.1",
  createdAt: "2024-04-12T09:00:00.000Z",
};

const meta = {
  title: "Domain/User/SessionListItem",
  component: SessionListItem,
  args: {
    session,
    isCurrent: false,
    onRevoke: () => {},
  },
} satisfies Meta<typeof SessionListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: { isCurrent: true },
};

export const Loading: Story = {
  args: { revoking: true },
};
