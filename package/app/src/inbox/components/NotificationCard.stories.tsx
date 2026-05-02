import type { Meta, StoryObj } from "@storybook/react-vite";

import { NotificationCard } from "./NotificationCard";

const meta = {
  title: "Domain/Inbox/NotificationCard",
  component: NotificationCard,
  parameters: {
    docs: {
      description: {
        component:
          "Placeholder notification card. Stories cover one named export per notification type as fixtures already exist in `stories/fixtures/notification.ts`; the renderer itself is a stub awaiting backend wiring.",
      },
    },
  },
} satisfies Meta<typeof NotificationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
