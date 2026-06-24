import type { Meta, StoryObj } from "@storybook/react-vite";

import { TokenListItem } from "./TokenListItem";

const baseToken = {
  id: "tok-1",
  name: "Personal CLI",
  scopes: { user: ["read"], post: ["read", "write"] },
  createdAt: "2024-03-12T09:00:00.000Z",
  expiresAt: "2025-03-12T09:00:00.000Z",
  lastUsedAt: "2024-04-30T14:20:00.000Z",
  lastIP: "192.0.2.1",
} as never;

const meta = {
  title: "Domain/User/TokenListItem",
  component: TokenListItem,
  args: {
    token: baseToken,
    onEdit: () => {},
    onRevoke: () => {},
  },
} satisfies Meta<typeof TokenListItem>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Compact: Story = {
  args: {
    token: {
      ...baseToken,
      scopes: undefined,
      expiresAt: null,
      lastUsedAt: null,
      lastIP: null,
    } as never,
  },
};
