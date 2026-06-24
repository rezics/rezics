import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  notificationComment,
  notificationFavorite,
  notificationFollow,
  notificationMention,
  notificationSystem,
  notificationUpvote,
} from "../../stories/fixtures/notification";
import { NotificationCard } from "./NotificationCard";

const meta = {
  title: "Domain/Inbox/NotificationCard",
  component: NotificationCard,
  parameters: {
    docs: {
      description: {
        component:
          "Renders one notification item. The component owns the per-kind copy mapping (`upvoted`, `followed you`, etc.) and shows an unread dot for `read=false` rows.",
      },
    },
  },
} satisfies Meta<typeof NotificationCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Upvote: Story = { args: { item: notificationUpvote } };
export const Comment: Story = { args: { item: notificationComment } };
export const Follow: Story = { args: { item: notificationFollow } };
export const Mention: Story = { args: { item: notificationMention } };
export const Favorite: Story = { args: { item: notificationFavorite } };
export const System: Story = { args: { item: notificationSystem } };
