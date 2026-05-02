import InboxIcon from "@mui/icons-material/InboxOutlined";
import Button from "@mui/material/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";

import { EmptyState } from "./EmptyState";

const meta = {
  title: "Composite/Feedback/EmptyState",
  component: EmptyState,
  args: {
    title: "Nothing here yet",
  },
} satisfies Meta<typeof EmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    title: "No reviews yet",
    description: "Be the first reader to share what you thought.",
  },
};

export const WithAction: Story = {
  args: {
    title: "Your shelf is empty",
    description: "Save a book to start tracking your reading.",
    icon: <InboxIcon fontSize="large" />,
    action: <Button variant="contained">Browse books</Button>,
  },
};
